import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import layoutStyles from '../styles';
import ViaIcon from '../ViaIcon';

const SKIP_PREFIXES = ['__MACOSX/', '.git/'];
const shouldSkipEntry = (path) => SKIP_PREFIXES.some(prefix => path.startsWith(prefix) || path.includes(`/${prefix}`));

const TOKEN_HELP_STEPS = [
  'Log in at github.com',
  'Open your top-right profile photo > Settings',
  'Scroll to the bottom of the left menu and go to "Developer settings"',
  'Select "Personal access tokens" > "Tokens (classic)"',
  'Click "Generate new token (classic)" and give it a name',
  'Tick the "repo" checkbox, hit "Generate token", then copy it and paste it here'
];

// Creates or updates one file in a GitHub repo via the Contents API.
// SMART DIFF: before pushing, compares the local file's base64 content
// against what's already on GitHub (fetched in the same GET call we need
// anyway to grab the sha). If they're identical, the push is skipped
// entirely — no wasted commit, no wasted API call — same idea as the
// smart-diff behaviour in the Next.js ZIP Pusher tool.
async function pushFileToGithub({ token, owner, repoName, branch, path, contentBase64, message }) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodedPath}`;
  let sha;
  let remoteContentNormalized = null;
  try {
    const getResp = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (getResp.ok) {
      const data = await getResp.json();
      sha = data.sha;
      if (typeof data.content === 'string') {
        remoteContentNormalized = data.content.replace(/\s/g, '');
      }
    }
  } catch (e) { /* file probably doesn't exist yet on this branch — that's fine */ }

  const localNormalized = contentBase64.replace(/\s/g, '');
  if (remoteContentNormalized !== null && remoteContentNormalized === localNormalized) {
    return { skipped: true };
  }

  const putResp = await fetch(apiUrl, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: contentBase64, branch, ...(sha ? { sha } : {}) })
  });

  if (!putResp.ok) {
    const err = await putResp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${putResp.status}`);
  }
  const result = await putResp.json();
  return { skipped: false, ...result };
}

export default function ZipPusherModal({ visible, isNightMode, setCurrentModal, showToast }) {
  const [screen, setScreen] = useState('main'); // 'main' | 'token_settings'
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  const [ghToken, setGhToken] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('Update via AI Browser ZIP Pusher');

  const [repoList, setRepoList] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);

  const [zipInstance, setZipInstance] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [extractedPaths, setExtractedPaths] = useState([]);
  const [failedPaths, setFailedPaths] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logLines, setLogLines] = useState([]);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, r, b] = await Promise.all([
          AsyncStorage.getItem('@vault_gh_token'),
          AsyncStorage.getItem('@vault_gh_repo'),
          AsyncStorage.getItem('@vault_gh_branch')
        ]);
        if (t) { setGhToken(t); setTokenDraft(t); fetchRepoList(t); }
        if (r) setRepoPath(r);
        if (b) setBranch(b);
      } catch (e) { /* ignore — fields just stay blank */ }
    })();
  }, []);

  if (!visible) return null;

  const appendLog = (line) => setLogLines(prev => [...prev.slice(-49), line]);
  const closePanel = () => setCurrentModal(null);

  const fetchRepoList = async (tok) => {
    const useToken = (tok || ghToken || '').trim();
    if (!useToken) { setRepoList([]); return; }
    setReposLoading(true);
    try {
      const resp = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: { Authorization: `token ${useToken}`, Accept: 'application/vnd.github+json' }
      });
      if (resp.ok) {
        const data = await resp.json();
        setRepoList(Array.isArray(data) ? data.map(r => r.full_name) : []);
      } else {
        setRepoList([]);
      }
    } catch (e) {
      setRepoList([]);
    }
    setReposLoading(false);
  };

  const saveToken = async () => {
    const cleanToken = tokenDraft.trim();
    setGhToken(cleanToken);
    await AsyncStorage.setItem('@vault_gh_token', cleanToken);
    showToast && showToast('GitHub token saved');
    fetchRepoList(cleanToken);
    setScreen('main');
  };

  const selectRepo = async (fullName) => {
    setRepoPath(fullName);
    setShowRepoDropdown(false);
    await AsyncStorage.setItem('@vault_gh_repo', fullName);
  };

  const saveBranch = async (val) => {
    setBranch(val);
    await AsyncStorage.setItem('@vault_gh_branch', val || 'main');
  };

  const resetSelection = () => {
    setZipInstance(null);
    setSelectedFileName('');
    setExtractedPaths([]);
    setFailedPaths([]);
    setProgress({ done: 0, total: 0 });
  };

  const pickZipFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        copyToCacheDirectory: true
      });
      if (result.canceled) return;
      const asset = result.assets ? result.assets[0] : result;

      resetSelection();
      setIsBusy(true);
      setLogLines([]);
      appendLog(`Reading ${asset.name || 'archive.zip'}...`);

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      appendLog('Unzipping on-device...');
      const zip = await JSZip.loadAsync(base64, { base64: true });

      const entries = [];
      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir || shouldSkipEntry(relativePath)) return;
        entries.push(relativePath);
      });

      setZipInstance(zip);
      setSelectedFileName(asset.name || 'archive.zip');
      setExtractedPaths(entries);
      appendLog(`Found ${entries.length} file${entries.length === 1 ? '' : 's'} ready to push.`);
    } catch (e) {
      appendLog(`Error: ${e.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const pushPaths = async (paths) => {
    if (!ghToken.trim()) { appendLog('Set your GitHub token first using the gear icon.'); return; }
    const [owner, repoName] = (repoPath || '').split('/').map(s => s.trim());
    if (!owner || !repoName) { appendLog('Select a repository from the dropdown.'); return; }
    if (!zipInstance || paths.length === 0) { appendLog('Nothing to push.'); return; }

    setIsBusy(true);
    setProgress({ done: 0, total: paths.length });
    const stillFailed = [];
    let doneCount = 0;
    let pushedCount = 0;
    let skippedCount = 0;

    for (const path of paths) {
      try {
        appendLog(`Checking ${path}...`);
        const contentBase64 = await zipInstance.files[path].async('base64');
        const result = await pushFileToGithub({
          token: ghToken.trim(),
          owner,
          repoName,
          branch: branch.trim() || 'main',
          path,
          contentBase64,
          message: commitMessage.trim() || 'Update via AI Browser ZIP Pusher'
        });
        doneCount++;
        setProgress({ done: doneCount, total: paths.length });
        if (result.skipped) {
          skippedCount++;
          appendLog(`⏭ ${path} — unchanged, skipped`);
        } else {
          pushedCount++;
          appendLog(`✓ ${path} — pushed`);
        }
      } catch (e) {
        appendLog(`✗ ${path} — ${e.message}`);
        stillFailed.push(path);
      }
    }

    setFailedPaths(stillFailed);
    const summary = `Smart diff done — ${pushedCount} pushed, ${skippedCount} unchanged (skipped), ${stillFailed.length} failed.`;
    appendLog(summary);
    showToast && showToast(stillFailed.length ? `Pushed with ${stillFailed.length} failures` : `Pushed ${pushedCount}, skipped ${skippedCount} unchanged`);
    setIsBusy(false);
  };

  const textColor = isNightMode ? '#ffffff' : '#0f172a';
  const dimText = isNightMode ? '#94a3b8' : '#64748b';
  const cardBg = isNightMode ? '#1e1e1e' : '#ffffff';
  const borderColor = isNightMode ? '#333333' : '#e2e8f0';

  // ---------------- TOKEN SETTINGS SCREEN ----------------
  if (screen === 'token_settings') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
        <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel, { flexDirection: 'row', alignItems: 'center' }]}>
          <TouchableOpacity onPress={() => setScreen('main')} style={{ paddingRight: 12 }}>
            <ViaIcon type="back_chevron" size={22} color={textColor} />
          </TouchableOpacity>
          <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>GitHub Token Settings</Text>
        </View>

        <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock} keyboardShouldPersistTaps="handled">
          <View style={layoutStyles.settingsSectionBlockPadded}>
            <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Personal Access Token</Text>
            <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Stored only on this device. Needs a token with "repo" scope.</Text>

            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                style={[layoutStyles.settingsApiKeyInputField, { paddingRight: 42 }, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor="#94a3b8"
                value={tokenDraft}
                onChangeText={setTokenDraft}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity
                onPress={() => setShowTokenHelp(true)}
                style={{ position: 'absolute', right: 12, top: 22 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ViaIcon type="help_circle" size={19} color={dimText} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={layoutStyles.settingsSaveAiConfigButton} onPress={saveToken}>
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Save Token</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={showTokenHelp} transparent animationType="fade" onRequestClose={() => setShowTokenHelp(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 18, width: '100%', maxWidth: 340 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textColor }}>How to create a token</Text>
                <TouchableOpacity onPress={() => setShowTokenHelp(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <ViaIcon type="close" size={20} color={dimText} />
                </TouchableOpacity>
              </View>
              {TOKEN_HELP_STEPS.map((step, idx) => (
                <View key={idx} style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <Text style={{ color: '#4f46e5', fontWeight: '800', fontSize: 13, width: 20 }}>{idx + 1}.</Text>
                  <Text style={{ color: textColor, fontSize: 13, flex: 1, lineHeight: 18 }}>{step}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={{ marginTop: 6, height: 40, borderRadius: 10, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowTokenHelp(false)}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ---------------- MAIN ZIP PUSHER SCREEN ----------------
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={closePanel} style={{ paddingRight: 12 }}>
            <ViaIcon type="back_chevron" size={22} color={textColor} />
          </TouchableOpacity>
          <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>ZIP → GitHub Pusher</Text>
        </View>
        <TouchableOpacity onPress={() => { setTokenDraft(ghToken); setScreen('token_settings'); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ViaIcon type="settings" size={21} color={textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock} keyboardShouldPersistTaps="handled">

        {!ghToken.trim() && (
          <View style={[layoutStyles.settingsSectionBlockPadded, { backgroundColor: isNightMode ? '#2d2d2d' : '#fef9c3', borderRadius: 12, paddingHorizontal: 14, marginTop: 10 }]}>
            <Text style={{ color: isNightMode ? '#facc15' : '#92400e', fontSize: 13, fontWeight: '600' }}>
              ⚠ Set your GitHub token first using the top-right gear icon.
            </Text>
          </View>
        )}

        <View style={layoutStyles.settingsSectionBlockPadded}>
          <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Repository</Text>
          <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Select the repo you want to push to</Text>

          <TouchableOpacity
            disabled={!ghToken.trim()}
            onPress={() => { fetchRepoList(); setShowRepoDropdown(true); }}
            style={[
              layoutStyles.settingsApiKeyInputField,
              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: ghToken.trim() ? 1 : 0.5 },
              isNightMode && { backgroundColor: '#2d2d2d', borderColor: '#444444' }
            ]}
          >
            <Text style={{ color: repoPath ? textColor : '#94a3b8', fontSize: 14 }} numberOfLines={1}>
              {repoPath || 'Select repository'}
            </Text>
            <ViaIcon type="chevron_down" size={16} color={dimText} />
          </TouchableOpacity>
        </View>

        <View style={layoutStyles.settingsSectionBlockPadded}>
          <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Branch</Text>
          <TextInput
            style={[layoutStyles.settingsApiKeyInputField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
            placeholder="main"
            placeholderTextColor="#94a3b8"
            value={branch}
            onChangeText={saveBranch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[layoutStyles.settingsSectionBlockPadded, { marginTop: 4 }]}>
          <TouchableOpacity
            style={[layoutStyles.settingsSaveAiConfigButton, { backgroundColor: '#0f172a', marginTop: 4, opacity: repoPath ? 1 : 0.5 }]}
            onPress={pickZipFile}
            disabled={isBusy || !repoPath}
          >
            {isBusy && extractedPaths.length === 0 ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>📦 Pick ZIP File</Text>
            )}
          </TouchableOpacity>

          {!!selectedFileName && (
            <View style={{ marginTop: 14, backgroundColor: isNightMode ? '#1e1e1e' : '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor }}>
              <Text style={{ color: textColor, fontWeight: '700', fontSize: 13.5 }}>
                {selectedFileName} — {extractedPaths.length} file{extractedPaths.length === 1 ? '' : 's'} ready
              </Text>
              <Text style={{ color: dimText, fontSize: 12.5, marginTop: 4 }}>
                Will push to: {repoPath || '—'} ({branch || 'main'})
              </Text>
              <ScrollView style={{ maxHeight: 110, marginTop: 8 }}>
                {extractedPaths.map((p, idx) => (
                  <Text key={idx} style={{ color: dimText, fontSize: 11.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 2 }}>
                    • {p}
                  </Text>
                ))}
              </ScrollView>

              <Text style={[layoutStyles.settingsToggleItemSecondarySubDescriptionTextString, { marginTop: 10 }]}>Commit message</Text>
              <TextInput
                style={[layoutStyles.settingsApiKeyInputField, { marginTop: 6 }, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
                placeholder="Update via AI Browser ZIP Pusher"
                placeholderTextColor="#94a3b8"
                value={commitMessage}
                onChangeText={setCommitMessage}
              />

              <TouchableOpacity
                style={[layoutStyles.settingsSaveAiConfigButton, { backgroundColor: '#4f46e5', marginTop: 14, marginBottom: 0 }]}
                onPress={() => pushPaths(extractedPaths)}
                disabled={isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                    🚀 Push {extractedPaths.length} file{extractedPaths.length === 1 ? '' : 's'} to GitHub
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {progress.total > 0 && (
            <Text style={[layoutStyles.settingsToggleItemSecondarySubDescriptionTextString, { marginTop: 10 }]}>
              Progress: {progress.done} / {progress.total}
            </Text>
          )}

          {failedPaths.length > 0 && (
            <TouchableOpacity
              style={[layoutStyles.settingsSaveAiConfigButton, { backgroundColor: '#ef4444', marginTop: 10 }]}
              onPress={() => pushPaths(failedPaths)}
              disabled={isBusy}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>🔁 Retry {failedPaths.length} Failed</Text>
            </TouchableOpacity>
          )}
        </View>

        {logLines.length > 0 && (
          <View style={[
            { marginHorizontal: 16, marginTop: 4, marginBottom: 24, borderRadius: 12, padding: 12, backgroundColor: '#0f172a' }
          ]}>
            {logLines.map((line, idx) => (
              <Text key={idx} style={{ color: '#d1fae5', fontSize: 11.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 2 }}>
                {line}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showRepoDropdown} transparent animationType="fade" onRequestClose={() => setShowRepoDropdown(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 28 }} activeOpacity={1} onPress={() => setShowRepoDropdown(false)}>
          <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 14, width: '100%', maxWidth: 360, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: textColor }}>Choose a repository</Text>
              <TouchableOpacity onPress={() => setShowRepoDropdown(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <ViaIcon type="close" size={20} color={dimText} />
              </TouchableOpacity>
            </View>
            {reposLoading ? (
              <ActivityIndicator color="#4f46e5" style={{ marginVertical: 20 }} />
            ) : repoList.length === 0 ? (
              <Text style={{ color: dimText, fontSize: 13, paddingVertical: 16, textAlign: 'center' }}>No repos found. Check your token.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {repoList.map((full_name) => (
                  <TouchableOpacity
                    key={full_name}
                    onPress={() => selectRepo(full_name)}
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}
                  >
                    <Text style={{ color: full_name === repoPath ? '#4f46e5' : textColor, fontWeight: full_name === repoPath ? '700' : '500', fontSize: 14 }}>
                      {full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}
