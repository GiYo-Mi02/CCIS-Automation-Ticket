import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { apiFetch } from '../api/client.js';

const SCANNERS = [
  { key: 'scannerA', label: 'Scanner A', regionId: 'qr-reader-a' },
  { key: 'scannerB', label: 'Scanner B', regionId: 'qr-reader-b' }
];

const DUPLICATE_GUARD_MS = 1500;

function createInitialScannerState() {
  return {
    statusMsg: 'Align QR code within the frame',
    lastResult: null,
    scanStatus: 'idle', // idle | success | used | invalid | error | processing
    isVerifying: false,
    isStarting: false,
    error: null,
    errorDetail: null
  };
}

function pickDefaultCamera(devices = []) {
  if (!devices.length) return null;
  const backCamera = devices.find((device) => /back|rear|environment/i.test(device.label));
  return backCamera?.id ?? devices[0].id;
}

function describeCameraError(error) {
  const isSecure = typeof window !== 'undefined' && window.isSecureContext;
  const httpsHint = isSecure ? '' : ' Make sure you are using HTTPS or localhost.';

  if (!error) {
    return {
      status: 'Scanner inactive.',
      message: `Unable to start the selected camera. Refresh the list or choose another device.${httpsHint}`
    };
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        status: 'Camera permission blocked.',
        message: 'Camera access was denied. Allow access in your browser permissions, then press Retry.'
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        status: 'Camera busy.',
        message:
          'Another application is using the camera. Close other apps or tabs that use the camera, then press Retry.'
      };
    case 'OverconstrainedError':
      return {
        status: 'Camera not compatible.',
        message:
          'The selected camera does not support this configuration. Pick a different camera or reduce quality.'
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        status: 'Camera unavailable.',
        message: 'The camera is no longer available. Refresh the list or reconnect your device.'
      };
    default:
      return {
        status: 'Scanner inactive.',
        message: `Unable to start the selected camera${error.message ? ` (${error.message})` : ''}. Refresh or pick another device.${httpsHint}`
      };
  }
}

function ScannerPage() {
  const [activeTab, setActiveTab] = useState(0);

  // --- Audio Tone Engine ----------------------------------------------------
  const audioCtxRef = useRef(null);
  const lastPlayedRef = useRef({}); // key -> timestamp to debounce rapid repeats

  const ensureAudioContext = () => {
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      } catch (err) {
        console.warn('Web Audio not supported', err);
      }
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback((sequenceKey, steps) => {
    const ctx = ensureAudioContext();
    if (!ctx || !Array.isArray(steps) || steps.length === 0) return;
    const now = ctx.currentTime;
    const last = lastPlayedRef.current[sequenceKey] || 0;
    if (now - last < 0.4) return; // minimal debounce
    lastPlayedRef.current[sequenceKey] = now;

    steps.forEach((step, i) => {
      const { freq = 880, dur = 0.12, vol = 0.25, type = 'sine', glide = 0 } = step || {};
      const start = now + i * (step.offset ?? dur * 0.85);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.01);
      gain.gain.linearRampToValueAtTime(0.0001, start + dur);
      if (glide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), start + dur);
      }
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }, []);

  const playStatusTone = useCallback((status) => {
    switch (status) {
      case 'success':
        // Pleasant ascending triad
        playTone('success', [
          { freq: 523.25, dur: 0.10, vol: 0.22, type: 'sine' },
          { freq: 659.25, dur: 0.11, vol: 0.22, type: 'sine' },
          { freq: 784.0, dur: 0.14, vol: 0.20, type: 'sine' }
        ]);
        break;
      case 'used':
      case 'invalid':
        // Sharp dissonant double beep
        playTone('invalid', [
          { freq: 480, dur: 0.12, vol: 0.23, type: 'square' },
          { freq: 360, dur: 0.18, vol: 0.23, type: 'square', offset: 0.12 }
        ]);
        break;
      case 'error':
        playTone('error', [
          { freq: 160, dur: 0.25, vol: 0.25, type: 'sawtooth', glide: -80 }
        ]);
        break;
      default:
        break;
    }
  }, [playTone]);

  // -------------------------------------------------------------------------
  const scannerRefs = useRef({});
  const statusResetRefs = useRef(SCANNERS.map(() => null));
  const lastDecodedRefs = useRef(SCANNERS.map(() => ({ text: null, timestamp: 0 })));
  const verifyingRefs = useRef(SCANNERS.map(() => false));

  const [availableCameras, setAvailableCameras] = useState([]);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [selectedCameraIds, setSelectedCameraIds] = useState(() => SCANNERS.map(() => null));
  const [scannerStates, setScannerStates] = useState(() => SCANNERS.map(() => createInitialScannerState()));

  const previousCameraIdsRef = useRef(SCANNERS.map(() => null));

  const updateScannerState = useCallback((index, partial) => {
    setScannerStates((prev) => {
      const next = [...prev];
      next[index] = { ...prev[index], ...partial };
      return next;
    });
  }, []);

  const stopScanner = useCallback(async (index) => {
    verifyingRefs.current[index] = false;
    clearTimeout(statusResetRefs.current[index]);
    statusResetRefs.current[index] = null;

    const { key } = SCANNERS[index];
    const instance = scannerRefs.current[key];
    if (!instance) return;

    if (instance.isScanning) {
      try {
        await instance.stop();
      } catch (err) {
        console.warn(`Failed to stop ${key}`, err);
      }
    }

    try {
      await instance.clear();
    } catch (err) {
      // ignore clear failures
    }
  }, []);

  const handleScan = useCallback(
    async (index, decodedText) => {
      if (verifyingRefs.current[index]) return;

      const now = Date.now();
      const lastDecoded = lastDecodedRefs.current[index];
      if (lastDecoded.text === decodedText && now - lastDecoded.timestamp < DUPLICATE_GUARD_MS) {
        return;
      }

      lastDecodedRefs.current[index] = { text: decodedText, timestamp: now };
      verifyingRefs.current[index] = true;
      updateScannerState(index, {
        isVerifying: true,
        statusMsg: 'Checking ticket…',
        scanStatus: 'processing',
        error: null,
        errorDetail: null
      });

      try {
        const result = await apiFetch('/api/scanner/verify-qr', {
          method: 'POST',
          body: { qr: decodedText }
        });

        updateScannerState(index, {
          lastResult: { ok: true, data: result, at: new Date() },
          statusMsg: `✅ Ticket accepted${result.attendeeName ? ` for ${result.attendeeName}` : ''} (${result.ticketCode}). Ready for the next attendee.`,
          scanStatus: 'success',
          error: null,
          errorDetail: null
        });
        playStatusTone('success');
      } catch (err) {
        // Map error to scan status (used / invalid / generic)
        let derivedStatus = 'error';
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('already used')) {
          derivedStatus = 'used';
        } else if (msg.includes('cancelled') || msg.includes('signature') || msg.includes('not valid') || msg.includes('not found') || msg.includes('invalid')) {
          derivedStatus = 'invalid';
        }
        updateScannerState(index, {
          lastResult: {
            ok: false,
            message: err.message,
            at: new Date(),
            data: err.payload || null
          },
          statusMsg: `❌ ${err.message || 'Rejected'}. Present another ticket when ready.`,
          scanStatus: derivedStatus,
          error: null,
          errorDetail: null
        });
        playStatusTone(derivedStatus);
      } finally {
        verifyingRefs.current[index] = false;
        updateScannerState(index, { isVerifying: false });

        clearTimeout(statusResetRefs.current[index]);
        statusResetRefs.current[index] = setTimeout(() => {
          updateScannerState(index, { statusMsg: 'Scanner ready. Present the QR code.', scanStatus: 'idle' });
        }, DUPLICATE_GUARD_MS);
      }
    },
    [updateScannerState, playStatusTone]
  );

  const startScanner = useCallback(
    async (index, cameraId) => {
      if (!cameraId) return;

      const { key } = SCANNERS[index];
      const instance = scannerRefs.current[key];
      if (!instance) return;

      clearTimeout(statusResetRefs.current[index]);
      statusResetRefs.current[index] = null;

      updateScannerState(index, {
        isStarting: true,
        statusMsg: 'Starting camera…',
        error: null,
        errorDetail: null
      });

      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch (err) {
        console.warn(`Failed to stop existing scan for ${key}`, err);
      }

      try {
        await instance.start(
          { deviceId: { exact: cameraId } },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText) => handleScan(index, decodedText),
          (errorMessage) => {
            if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('no qr code')) {
              return;
            }
            console.warn(`${key} scan warning`, errorMessage);
          }
        );

        updateScannerState(index, {
          isStarting: false,
          statusMsg: 'Scanner ready. Present the QR code.',
          error: null,
          errorDetail: null
        });
      } catch (err) {
        const { status, message } = describeCameraError(err);
        clearTimeout(statusResetRefs.current[index]);
        statusResetRefs.current[index] = null;

        updateScannerState(index, {
          isStarting: false,
          statusMsg: status,
          error: message,
          errorDetail: err?.message || null
        });

        try {
          await stopScanner(index);
        } catch (stopErr) {
          console.warn(`Failed to cleanup ${key} after error`, stopErr);
        }
      }
    },
    [handleScan, stopScanner, updateScannerState]
  );

  const refreshCameraList = useCallback(async () => {
    setIsCameraLoading(true);

    try {
      const devices = await Html5Qrcode.getCameras();

      if (!devices || devices.length === 0) {
        setAvailableCameras([]);
        setSelectedCameraIds((prev) => {
          const next = SCANNERS.map(() => null);
          const changed = next.some((value, index) => value !== prev[index]);
          return changed ? next : prev;
        });

        SCANNERS.forEach((_, index) => {
          updateScannerState(index, {
            statusMsg: 'No camera detected. Connect a camera and refresh.',
            error: 'No camera detected. Connect a camera and refresh.',
            errorDetail: null
          });
        });
        return;
      }

      setAvailableCameras(devices);

      SCANNERS.forEach((_, index) => {
        updateScannerState(index, {
          error: null,
          errorDetail: null
        });
      });

      setSelectedCameraIds((prev) => {
        const mapped = prev.map((currentId) =>
          devices.some((device) => device.id === currentId) ? currentId : null
        );

        const used = new Set(mapped.filter(Boolean));
        const orderedDeviceIds = devices.map((device) => device.id);

        const filled = mapped.map((currentId, idx) => {
          if (currentId) return currentId;

          let candidate = null;
          if (idx === 0) {
            const preferred = pickDefaultCamera(devices);
            if (preferred && !used.has(preferred)) {
              candidate = preferred;
            }
          }

          if (!candidate) {
            candidate = orderedDeviceIds.find((id) => !used.has(id)) ?? null;
          }

          if (candidate) {
            used.add(candidate);
          }

          return candidate;
        });

        const changed = filled.some((value, index) => value !== prev[index]);
        return changed ? filled : prev;
      });
    } catch (err) {
      console.error('Failed to enumerate cameras', err);
      setAvailableCameras([]);

      SCANNERS.forEach((_, index) => {
        updateScannerState(index, {
          statusMsg: 'Camera access blocked.',
          error: 'Unable to access camera list. Check browser permissions.',
          errorDetail: err?.message || null
        });
      });
    } finally {
      setIsCameraLoading(false);
    }
  }, [updateScannerState]);

  useEffect(() => {
    const instances = {};
    SCANNERS.forEach(({ key, regionId }) => {
      instances[key] = new Html5Qrcode(regionId);
    });
    scannerRefs.current = instances;

    refreshCameraList();

    return () => {
      statusResetRefs.current.forEach((timer) => clearTimeout(timer));
      SCANNERS.forEach((_, index) => {
        stopScanner(index).catch(() => undefined);
      });
      scannerRefs.current = {};
    };
  }, [refreshCameraList, stopScanner]);

  useEffect(() => {
    selectedCameraIds.forEach((cameraId, index) => {
      const previousId = previousCameraIdsRef.current[index];
      if (previousId === cameraId) {
        return;
      }

      previousCameraIdsRef.current[index] = cameraId;

      if (cameraId) {
        startScanner(index, cameraId);
      } else {
        stopScanner(index).catch(() => undefined);
        updateScannerState(index, {
          statusMsg: availableCameras.length
            ? 'Select a camera to begin.'
            : 'No camera selected.',
          error: availableCameras.length ? null : 'No camera assigned.',
          errorDetail: null
        });
      }
    });
  }, [availableCameras.length, selectedCameraIds, startScanner, stopScanner, updateScannerState]);

  const handleCameraChange = useCallback((index, cameraId) => {
    setSelectedCameraIds((prev) => {
      if (prev[index] === cameraId) {
        return prev;
      }
      const next = [...prev];
      next[index] = cameraId || null;
      return next;
    });
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-8">
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        <p className="text-sm font-medium text-gray-500">Live validation</p>
        <h2 className="text-2xl font-semibold text-gray-900 mt-1">Dual QR scanners</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-2xl">
          Connect up to two cameras for parallel ticket checks. Each station runs independently so you can assign
          separate entry lanes and keep the queue moving.
        </p>
      </section>

      {/* Mobile Tab Toggle */}
      <div className="flex bg-gray-100 p-1 rounded-lg xl:hidden">
        {SCANNERS.map((config, index) => (
          <button 
            key={config.key} 
            onClick={() => setActiveTab(index)} 
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === index ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {config.label}
          </button>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        {SCANNERS.map((config, index) => {
          const state = scannerStates[index];
          const selectedId = selectedCameraIds[index] ?? '';

          const getStatusStyles = () => {
             if (state.scanStatus === 'processing') return 'bg-blue-100 text-blue-700';
             if (state.scanStatus === 'success') return 'bg-green-100 text-green-700';
             if (state.scanStatus === 'used' || state.scanStatus === 'invalid' || state.scanStatus === 'error') return 'bg-red-100 text-red-700';
             return 'bg-gray-100 text-gray-600';
          };

          return (
            <div key={config.key} className={`bg-white rounded-xl shadow-sm border border-gray-200 flex-col gap-5 p-6 ${activeTab === index ? 'flex' : 'hidden xl:flex'}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{config.label}</p>
                  <h3 className="text-lg font-semibold text-gray-900">Scanner station</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${getStatusStyles()}`}
                  >
                    {state.scanStatus === 'processing'
                      ? 'Processing'
                      : state.scanStatus === 'success'
                      ? 'Accepted'
                      : state.scanStatus === 'used'
                      ? 'Used'
                      : state.scanStatus === 'invalid'
                      ? 'Invalid'
                      : state.scanStatus === 'error'
                      ? 'Error'
                      : 'Idle'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="text-sm font-medium text-gray-700 shrink-0" htmlFor={`camera-select-${config.key}`}>
                    Camera source
                  </label>
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      id={`camera-select-${config.key}`}
                      value={selectedId}
                      onChange={(event) => handleCameraChange(index, event.target.value || null)}
                      disabled={isCameraLoading || state.isStarting || availableCameras.length === 0}
                      className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block text-sm focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                  {availableCameras.length === 0 ? (
                    <option value="">{isCameraLoading ? 'Detecting cameras…' : 'No cameras found'}</option>
                  ) : (
                    <>
                      <option value="">Select a camera</option>
                      {availableCameras.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.label || `Camera ${device.id}`}
                        </option>
                      ))}
                    </>
                  )}
                    </select>
                    <button
                      type="button"
                      onClick={refreshCameraList}
                      disabled={isCameraLoading}
                      className="bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                    >
                      {isCameraLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full">
                <div id={config.regionId} className="w-full aspect-[4/3] sm:aspect-video object-cover overflow-hidden rounded-2xl border-2 border-gray-200 shadow-sm bg-gray-50"></div>
              </div>

              <p className="text-center text-sm font-medium text-gray-600">
                {state.isStarting ? 'Starting camera…' : state.statusMsg}
              </p>

              {state.error && (
                <div className="space-y-2 bg-red-50 border-l-4 border-red-500 text-red-800 p-4">
                  <p className="font-semibold text-sm">Camera issue</p>
                  <p className="text-sm">{state.error}</p>
                  {state.errorDetail && (
                    <p className="text-xs opacity-80">Details: {state.errorDetail}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const cameraId = selectedCameraIds[index];
                        if (cameraId) {
                          startScanner(index, cameraId);
                        } else {
                          refreshCameraList();
                        }
                      }}
                      disabled={state.isStarting}
                      className="text-sm font-semibold text-red-900 hover:text-red-700 underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Retry camera
                    </button>
                    <button
                      type="button"
                      onClick={refreshCameraList}
                      disabled={isCameraLoading}
                      className="text-sm font-semibold text-red-900 hover:text-red-700 underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Refresh list
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 mt-auto">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Last scan</h4>
                {state.lastResult ? (
                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    <p>
                      Result:{' '}
                      <span
                        className={`font-semibold ${
                          state.lastResult.ok ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {state.lastResult.ok ? 'ACCEPTED' : 'REJECTED'}
                      </span>
                    </p>
                    <p>Timestamp: {state.lastResult.at.toLocaleTimeString()}</p>
                    {state.lastResult.ok ? (
                      <>
                        <p>Ticket: <span className="font-medium text-gray-900">{state.lastResult.data.ticketCode}</span></p>
                        {state.lastResult.data.attendeeName && <p>Name: <span className="font-medium text-gray-900">{state.lastResult.data.attendeeName}</span></p>}
                        {state.lastResult.data.studentSection && <p>Section: <span className="font-medium text-gray-900">{state.lastResult.data.studentSection}</span></p>}
                        {state.lastResult.data.eventName && <p>Event: <span className="font-medium text-gray-900">{state.lastResult.data.eventName}</span></p>}
                        {state.lastResult.data.seatLabel && <p>Seat: <span className="font-medium text-gray-900">{state.lastResult.data.seatLabel}</span></p>}
                        <p className="pt-1">Status: {state.lastResult.data.message}</p>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <p>Reason: <span className="font-medium text-gray-900">{state.lastResult.message}</span></p>
                        {state.lastResult.data?.ticketCode && <p>Ticket: <span className="font-medium text-gray-900">{state.lastResult.data.ticketCode}</span></p>}
                        {state.lastResult.data?.attendeeName && <p>Name: <span className="font-medium text-gray-900">{state.lastResult.data.attendeeName}</span></p>}
                        {state.lastResult.data?.studentSection && <p>Section: <span className="font-medium text-gray-900">{state.lastResult.data.studentSection}</span></p>}
                        {state.lastResult.data?.seatLabel && <p>Seat: <span className="font-medium text-gray-900">{state.lastResult.data.seatLabel}</span></p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400 font-medium">No scans yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-sm text-gray-600">
        <h4 className="text-base font-semibold text-gray-900">Operational tips</h4>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Grant camera permissions in your browser for both devices. Use HTTPS (or localhost) to avoid permission issues.</li>
          <li>Assign different external cameras to each scanner for two simultaneous entry lanes.</li>
          <li>If a camera stops responding, refresh the list or reconnect the device—each scanner can be restarted independently.</li>
        </ul>
      </section>
    </div>
  );
}

export default ScannerPage;
