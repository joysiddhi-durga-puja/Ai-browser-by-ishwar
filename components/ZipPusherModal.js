import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import layoutStyles from '../styles';
import ViaIcon from '../ViaIcon';

const SKIP_PREFIXES = ['__MACOSX/', '.git/'];
const shouldSkipEntry = (path) => SKIP_PREFIXES.some(prefix => path.startsWith(prefix) || path.includes(`/${prefix}`));

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
  const [ghToken, setGhToken] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('Update via AI Browser ZIP Pusher');

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
        if (t) setGhToken(t);
        if (r) setRepoPath(r);
        if (b) setBranch(b);
      } catch (e) { /* ignore — fields just stay blank */ }
    })();
  }, []);

  if (!visible) return null;

  const appendLog = (line) => setLogLines(prev => [...prev.slice(-49), line]);
  const closePanel = () => setCurrentModal(null);

  const saveConfig = async () => {
    await AsyncStorage.setItem('@vault_gh_token', ghToken);
    await AsyncStorage.setItem('@vault_gh_repo', repoPath);
    await AsyncStorage.setItem('@vault_gh_branch', branch || 'main');
    showToast && showToast('GitHub settings saved');
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
    if (!ghToken.trim()) { appendLog('Add a GitHub token first.'); return; }
    const [owner, repoName] = (repoPath || '').split('/').map(s => s.trim());
    if (!owner || !repoName) { appendLog('Repo must be in owner/repo format.'); return; }
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[layoutStyles.fullscreenSystemOverlayContainerBlock, isNightMode && layoutStyles.nightModeShellBG]}>
      <View style={[layoutStyles.modalSingleHeaderTitleNavbarElementBlock, isNightMode && layoutStyles.nightComponentPanel, { flexDirection: 'row', alignItems: 'center' }]}>
        <TouchableOpacity onPress={closePanel} style={{ paddingRight: 12 }}>
          <ViaIcon type="back_chevron" size={22} color={isNightMode ? '#ffffff' : '#0f172a'} />
        </TouchableOpacity>
        <Text style={[layoutStyles.modalSingleNavbarHeaderHeadlineTitleLabelString, isNightMode && { color: '#ffffff' }]}>ZIP → GitHub Pusher</Text>
      </View>

      <ScrollView style={layoutStyles.settingsMenuInnerOperationalContainerLayoutSectionBlock} keyboardShouldPersistTaps="handled">
        <View style={layoutStyles.settingsSectionBlockPadded}>
          <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>GitHub Personal Access Token</Text>
          <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Stored only on this device. Needs "repo" scope from github.com/settings/tokens</Text>
          <Text style={[layoutStyles.settingsToggleItemSecondarySubDescriptionTextString, { marginTop: 4, fontStyle: 'italic' }]}>Smart diff on — unchanged files are auto-skipped, only new/modified files get pushed.</Text>
          <TextInput
            style={[layoutStyles.settingsApiKeyInputField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor="#94a3b8"
            value={ghToken}
            onChangeText={setGhToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        <View style={layoutStyles.settingsSectionBlockPadded}>
          <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Repository</Text>
          <Text style={layoutStyles.settingsToggleItemSecondarySubDescriptionTextString}>Format: owner/repo</Text>
          <TextInput
            style={[layoutStyles.settingsApiKeyInputField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
            placeholder="ishwar/my-project"
            placeholderTextColor="#94a3b8"
            value={repoPath}
            onChangeText={setRepoPath}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={layoutStyles.settingsSectionBlockPadded}>
          <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Branch</Text>
          <TextInput
            style={[layoutStyles.settingsApiKeyInputField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
            placeholder="main"
            placeholderTextColor="#94a3b8"
            value={branch}
            onChangeText={setBranch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={layoutStyles.settingsSectionBlockPadded}>
          <Text style={[layoutStyles.settingsToggleItemPrimaryHeadlineLabelTextString, isNightMode && { color: '#ffffff' }]}>Commit message</Text>
          <TextInput
            style={[layoutStyles.settingsApiKeyInputField, isNightMode && { color: '#ffffff', backgroundColor: '#2d2d2d', borderColor: '#444444' }]}
            placeholder="Update via AI Browser ZIP Pusher"
            placeholderTextColor="#94a3b8"
            value={commitMessage}
            onChangeText={setCommitMessage}
          />
        </View>

        <TouchableOpacity style={layoutStyles.settingsSaveAiConfigButton} onPress={saveConfig}>
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Save GitHub Settings</Text>
        </TouchableOpacity>

        <View style={[layoutStyles.settingsSectionBlockPadded, { marginTop: 6 }]}>
          <TouchableOpacity
            style={[layoutStyles.settingsSaveAiConfigButton, { backgroundColor: '#0f172a' }]}
            onPress={pickZipFile}
            disabled={isBusy}
          >
            {isBusy && extractedPaths.length === 0 ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>📦 Pick ZIP File</Text>
            )}
          </TouchableOpacity>

          {!!selectedFileName && (
            <Text style={[layoutStyles.settingsToggleItemSecondarySubDescriptionTextString, { marginTop: 10 }]}>
              {selectedFileName} — {extractedPaths.length} file{extractedPaths.length === 1 ? '' : 's'} found
            </Text>
          )}

          {extractedPaths.length > 0 && (
            <TouchableOpacity
              style={[layoutStyles.settingsSaveAiConfigButton, { backgroundColor: '#4f46e5', marginTop: 10 }]}
              onPress={() => pushPaths(extractedPaths)}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                  🚀 Smart Push {extractedPaths.length} file{extractedPaths.length === 1 ? '' : 's'} to GitHub
                </Text>
              )}
            </TouchableOpacity>
          )}

          {progress.total > 0 && (
            <Text style={[layoutStyles.settingsToggleItemSecondarySubDescriptionTextString, { marginTop: 8 }]}>
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
    </KeyboardAvoidingView>
  );
}
