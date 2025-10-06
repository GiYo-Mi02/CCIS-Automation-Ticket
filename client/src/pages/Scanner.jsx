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
          statusMsg: `✅ Ticket accepted (${result.ticketCode}). Ready for the next attendee.`,
          error: null,
          errorDetail: null
        });
      } catch (err) {
        updateScannerState(index, {
          lastResult: {
            ok: false,
            message: err.message,
            at: new Date(),
            data: err.payload || null
          },
          statusMsg: `❌ ${err.message || 'Rejected'}. Present another ticket when ready.`,
          error: null,
          errorDetail: null
        });
      } finally {
        verifyingRefs.current[index] = false;
        updateScannerState(index, { isVerifying: false });

        clearTimeout(statusResetRefs.current[index]);
        statusResetRefs.current[index] = setTimeout(() => {
          updateScannerState(index, { statusMsg: 'Scanner ready. Present the QR code.' });
        }, DUPLICATE_GUARD_MS);
      }
    },
    [updateScannerState]
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
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <section className="glass-panel px-8 py-8">
        <p className="glass-section-label">Live validation</p>
        <h2 className="page-heading">Dual QR scanners</h2>
        <p className="page-subheading">
          Connect up to two cameras for parallel ticket checks. Each station runs independently so you can assign
          separate entry lanes and keep the queue moving.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {SCANNERS.map((config, index) => {
          const state = scannerStates[index];
          const selectedId = selectedCameraIds[index] ?? '';

          return (
            <div key={config.key} className="glass-card flex flex-col gap-5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="glass-section-label">{config.label}</p>
                  <h3 className="text-lg font-semibold text-white">Scanner station</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${
                    state.isVerifying
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  {state.isVerifying ? 'Processing' : 'Idle'}
                </span>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="input-label" htmlFor={`camera-select-${config.key}`}>
                    Camera source
                  </label>
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      id={`camera-select-${config.key}`}
                      value={selectedId}
                      onChange={(event) => handleCameraChange(index, event.target.value || null)}
                      disabled={isCameraLoading || state.isStarting || availableCameras.length === 0}
                      className="input-field"
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
                      className="muted-button whitespace-nowrap text-xs uppercase tracking-[0.3em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCameraLoading ? 'Refreshing…' : 'Refresh cameras'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div id={config.regionId} className="mx-auto aspect-square max-w-sm overflow-hidden rounded-2xl bg-black/40"></div>
              </div>

              <p className="text-center text-sm font-medium text-slate-200">
                {state.isStarting ? 'Starting camera…' : state.statusMsg}
              </p>

              {state.error && (
                <div className="space-y-2 rounded-2xl border border-rose-500/40 bg-rose-500/15 p-4 text-center text-sm text-rose-100">
                  <p className="font-semibold uppercase tracking-[0.25em]">Camera issue</p>
                  <p className="text-rose-100/90">{state.error}</p>
                  {state.errorDetail && (
                    <p className="text-xs text-rose-200/80">Details: {state.errorDetail}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
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
                      className="muted-button border-rose-500/50 text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Retry camera
                    </button>
                    <button
                      type="button"
                      onClick={refreshCameraList}
                      disabled={isCameraLoading}
                      className="muted-button text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Refresh list
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Last scan</h4>
                {state.lastResult ? (
                  <div className="mt-2 space-y-2 text-sm text-slate-200/90">
                    <p>
                      Result:{' '}
                      <span
                        className={`font-semibold ${
                          state.lastResult.ok ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {state.lastResult.ok ? 'ACCEPTED' : 'REJECTED'}
                      </span>
                    </p>
                    <p>Timestamp: {state.lastResult.at.toLocaleTimeString()}</p>
                    {state.lastResult.ok ? (
                      <>
                        <p>Ticket: {state.lastResult.data.ticketCode}</p>
                        {state.lastResult.data.attendee && <p>Attendee: {state.lastResult.data.attendee}</p>}
                        {state.lastResult.data.eventName && <p>Event: {state.lastResult.data.eventName}</p>}
                        {state.lastResult.data.seatLabel && <p>Seat: {state.lastResult.data.seatLabel}</p>}
                        <p>Status: {state.lastResult.data.message}</p>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <p>Reason: {state.lastResult.message}</p>
                        {state.lastResult.data?.ticketCode && <p>Ticket: {state.lastResult.data.ticketCode}</p>}
                        {state.lastResult.data?.attendee && <p>Attendee: {state.lastResult.data.attendee}</p>}
                        {state.lastResult.data?.eventName && <p>Event: {state.lastResult.data.eventName}</p>}
                        {state.lastResult.data?.seatLabel && <p>Seat: {state.lastResult.data.seatLabel}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400/80">No scans yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="glass-card p-6 text-sm text-slate-200/85">
        <h4 className="text-base font-semibold text-white">Operational tips</h4>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Grant camera permissions in your browser for both devices. Use HTTPS (or localhost) to avoid permission issues.</li>
          <li>Assign different external cameras to each scanner for two simultaneous entry lanes.</li>
          <li>If a camera stops responding, refresh the list or reconnect the device—each scanner can be restarted independently.</li>
        </ul>
      </section>
    </div>
  );
}

export default ScannerPage;
