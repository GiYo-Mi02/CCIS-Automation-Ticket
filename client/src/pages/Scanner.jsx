import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { apiFetch } from '../api/client.js';

const REGION_ID = 'qr-reader-container';
const RESUME_DELAY_MS = 1500;

function pickDefaultCamera(devices = []) {
  if (!devices.length) return null;
  const backCamera = devices.find((device) => /back|rear|environment/i.test(device.label));
  return backCamera?.id ?? devices[0].id;
}

function ScannerPage() {
  const scannerRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const lastDecodedRef = useRef({ text: null, timestamp: 0 });

  const [statusMsg, setStatusMsg] = useState('Align QR code within the frame');
  const [lastResult, setLastResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);

  const handleScan = useCallback(
    async (decodedText) => {
      const now = Date.now();
      if (isVerifying) return;
      if (
        lastDecodedRef.current.text === decodedText &&
        now - lastDecodedRef.current.timestamp < RESUME_DELAY_MS
      ) {
        return;
      }

      lastDecodedRef.current = { text: decodedText, timestamp: now };

      if (scannerRef.current?.isScanning) {
        try {
          scannerRef.current.pause(true);
        } catch (err) {
          console.warn('Failed to pause scanner', err);
        }
      }

      setIsVerifying(true);
      setStatusMsg('Checking ticket…');
      try {
        const result = await apiFetch('/api/scanner/verify-qr', {
          method: 'POST',
          body: { qr: decodedText }
        });
        setLastResult({ ok: true, data: result, at: new Date() });
        setStatusMsg(`✅ Ticket accepted (${result.ticketCode})`);
      } catch (err) {
        setLastResult({
          ok: false,
          message: err.message,
          at: new Date(),
          data: err.payload || null
        });
        setStatusMsg(`❌ ${err.message || 'Rejected'}`);
      } finally {
        setIsVerifying(false);
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = setTimeout(() => {
          try {
            scannerRef.current?.resume();
          } catch (err) {
            console.warn('Failed to resume scanner', err);
          }
        }, RESUME_DELAY_MS);
      }
    },
    [isVerifying]
  );

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    if (scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn('Failed to stop scanner', err);
      }
    }
    try {
      await scannerRef.current.clear();
    } catch (err) {
      // ignore
    }
  }, []);

  const startScanner = useCallback(
    async (cameraId) => {
      if (!scannerRef.current || !cameraId) return;
      setIsStartingScanner(true);
      setCameraError(null);
      setStatusMsg('Starting camera…');

      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn('Failed to stop existing scan', err);
      }

      try {
        await scannerRef.current.start(
          { deviceId: { exact: cameraId } },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          handleScan,
          (errorMessage) => {
            if (
              typeof errorMessage === 'string' &&
              errorMessage.toLowerCase().includes('no qr code')
            ) {
              return;
            }
            console.warn('QR scan error', errorMessage);
          }
        );
        setStatusMsg('Scanner ready. Present the QR code.');
      } catch (err) {
        console.error('Failed to start scanner', err);
        setCameraError('Unable to start the selected camera. Try a different device or check permissions.');
        setStatusMsg('Scanner inactive.');
      } finally {
        setIsStartingScanner(false);
      }
    },
    [handleScan]
  );

  const refreshCameraList = useCallback(async () => {
    setIsCameraLoading(true);
    setCameraError(null);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setAvailableCameras([]);
        setSelectedCameraId(null);
        setStatusMsg('No camera detected. Connect a camera and refresh.');
        return;
      }

      setAvailableCameras(devices);
      setSelectedCameraId((current) => {
        if (current && devices.some((device) => device.id === current)) {
          return current;
        }
        return pickDefaultCamera(devices);
      });
    } catch (err) {
      console.error('Failed to enumerate cameras', err);
      setCameraError('Unable to access camera list. Check browser permissions.');
      setStatusMsg('Camera access blocked.');
    } finally {
      setIsCameraLoading(false);
    }
  }, []);

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode(REGION_ID);
    scannerRef.current = html5Qrcode;

    refreshCameraList();

    return () => {
      clearTimeout(resumeTimeoutRef.current);
      stopScanner().catch(() => undefined);
    };
  }, [refreshCameraList, stopScanner]);

  useEffect(() => {
    if (!selectedCameraId) return;
    startScanner(selectedCameraId);
  }, [selectedCameraId, startScanner]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">QR Scanner</h2>
        <p className="mt-1 text-sm text-slate-500">
          Scan attendee QR codes to validate tickets in real time. Grant camera access when prompted.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-slate-700" htmlFor="camera-select">
              Camera source
            </label>
            <div className="flex items-center gap-2">
              <select
                id="camera-select"
                value={selectedCameraId ?? ''}
                onChange={(event) => setSelectedCameraId(event.target.value || null)}
                disabled={isCameraLoading || isStartingScanner || availableCameras.length === 0}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                {availableCameras.length === 0 ? (
                  <option value="">{isCameraLoading ? 'Detecting cameras…' : 'No cameras found'}</option>
                ) : (
                  availableCameras.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label || `Camera ${device.id}`}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={refreshCameraList}
                disabled={isCameraLoading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCameraLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div id={REGION_ID} className="mx-auto aspect-square max-w-sm rounded-lg bg-black/5"></div>
          </div>

          <p className="mt-4 text-center text-sm font-medium text-slate-600">
            {isStartingScanner ? 'Starting camera…' : statusMsg}
          </p>
          {cameraError && <p className="mt-2 text-center text-sm text-rose-600">{cameraError}</p>}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800">Last scan</h3>
            {lastResult ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  Result:{' '}
                  <span className={`font-semibold ${lastResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {lastResult.ok ? 'ACCEPTED' : 'REJECTED'}
                  </span>
                </p>
                <p>Timestamp: {lastResult.at.toLocaleTimeString()}</p>
                {lastResult.ok ? (
                  <>
                    <p>Ticket: {lastResult.data.ticketCode}</p>
                    {lastResult.data.attendee && <p>Attendee: {lastResult.data.attendee}</p>}
                    {lastResult.data.eventName && <p>Event: {lastResult.data.eventName}</p>}
                    {lastResult.data.seatLabel && <p>Seat: {lastResult.data.seatLabel}</p>}
                    <p>Status: {lastResult.data.message}</p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p>Reason: {lastResult.message}</p>
                    {lastResult.data?.ticketCode && <p>Ticket: {lastResult.data.ticketCode}</p>}
                    {lastResult.data?.attendee && <p>Attendee: {lastResult.data.attendee}</p>}
                    {lastResult.data?.eventName && <p>Event: {lastResult.data.eventName}</p>}
                    {lastResult.data?.seatLabel && <p>Seat: {lastResult.data.seatLabel}</p>}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No scans yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-700">
            <h4 className="text-base font-semibold">Tips</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Hold the ticket steady and fill the frame with the QR code.</li>
              <li>If scanning fails, try refreshing the camera list or switching to a different device.</li>
              <li>Ensure the ticket hasn&apos;t already been marked as used.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ScannerPage;
