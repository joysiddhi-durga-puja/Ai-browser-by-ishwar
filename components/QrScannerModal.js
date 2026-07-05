import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ViaIcon from '../ViaIcon';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_W * 0.68;

// --- QR CODE SCANNER OVERLAY ---
// Opens the device camera, detects any QR code in view, and hands the
// decoded text back to App.js via onScanned. If the text looks like a URL
// it gets normalized there and loaded straight into the active tab;
// anything else falls back to a normal search query.
export default function QrScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const lockRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setHasScanned(false);
      lockRef.current = false;
      if (!permission || !permission.granted) requestPermission();
    }
  }, [visible]);

  if (!visible) return null;

  const handleBarcodeScanned = ({ data }) => {
    if (lockRef.current || !data) return;
    lockRef.current = true;
    setHasScanned(true);
    onScanned(data);
  };

  const permissionDenied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <View style={styles.overlay}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
        />
      ) : (
        <View style={styles.permissionFallback}>
          <ViaIcon type="qr_scan" size={40} color="#94a3b8" />
          <Text style={styles.permissionText}>
            {permissionDenied
              ? 'Camera permission was denied. Please enable it from your phone\'s app settings to scan QR codes.'
              : 'Camera permission is needed to scan QR codes.'}
          </Text>
          {!permissionDenied && (
            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
              <Text style={styles.grantBtnText}>Allow Camera</Text>
            </TouchableOpacity>
          )}
          {permissionDenied && (
            <TouchableOpacity style={styles.grantBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.grantBtnText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {permission?.granted && (
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.hintText}>Point your camera at a QR code</Text>
        </View>
      )}

      <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <ViaIcon type="close" size={24} color="#ffffff" />
        <Text style={styles.closeBtnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 999, justifyContent: 'center', alignItems: 'center' },
  frameWrap: { justifyContent: 'center', alignItems: 'center' },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE, borderWidth: 3, borderColor: '#4f46e5', borderRadius: 16, backgroundColor: 'transparent' },
  hintText: { color: '#ffffff', marginTop: 18, fontSize: 14, opacity: 0.85 },
  closeBtn: { position: 'absolute', top: 50, left: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 22 },
  closeBtnText: { color: '#ffffff', fontSize: 15, marginLeft: 4 },
  permissionFallback: { alignItems: 'center', paddingHorizontal: 32 },
  permissionText: { color: '#e2e8f0', textAlign: 'center', marginTop: 14, fontSize: 14, lineHeight: 20 },
  grantBtn: { marginTop: 20, backgroundColor: '#4f46e5', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 22 },
  grantBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 }
});
