'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Socket } from 'socket.io-client';
import { BuzzerState, Team } from '@/lib/gameState';
import { RefreshCw, Check, Copy, X, Wifi } from 'lucide-react';

interface BuzzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  buzzerState: BuzzerState;
  teamNames: { red: string; blue: string };
  localIPs: { ip: string; name: string }[];
}

export const BuzzerModal: React.FC<BuzzerModalProps> = ({
  isOpen,
  onClose,
  socket,
  buzzerState,
  teamNames,
  localIPs,
}) => {
  const [activeTab, setActiveTab] = useState<Team>('red');
  const [selectedBaseUrl, setSelectedBaseUrl] = useState<string>('');
  const [allIPs, setAllIPs] = useState<{ ip: string; name: string }[]>(localIPs || []);
  const [qrCodeRed, setQrCodeRed] = useState<string>('');
  const [qrCodeBlue, setQrCodeBlue] = useState<string>('');
  const [copiedTeam, setCopiedTeam] = useState<Team | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Helper to find the best Wi-Fi IP address
  const resolveWifiBaseUrl = (ips: { ip: string; name: string }[]): string => {
    if (typeof window === 'undefined') return '';
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    // First priority: A physical Wi-Fi/WLAN adapter that is NOT a virtual/hyper-v adapter
    const wifi = ips.find(
      (item) =>
        /wi-?fi|wlan|wireless/i.test(item.name) &&
        !/vethernet|vmware|virtual|pseudo/i.test(item.name)
    );
    if (wifi) {
      return `${protocol}//${wifi.ip}${port}`;
    }

    // Second priority: Physical Ethernet
    const eth = ips.find(
      (item) =>
        /eth|lan/i.test(item.name) &&
        !/vethernet|vmware|virtual|pseudo/i.test(item.name)
    );
    if (eth) {
      return `${protocol}//${eth.ip}${port}`;
    }

    // Third priority: Any non-virtual adapter
    const nonVirtual = ips.find(
      (item) => !/vethernet|vmware|virtual|pseudo/i.test(item.name)
    );
    if (nonVirtual) {
      return `${protocol}//${nonVirtual.ip}${port}`;
    }

    // Fallback to first available or origin
    if (ips.length > 0) {
      return `${protocol}//${ips[0].ip}${port}`;
    }

    return window.location.origin;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (localIPs && localIPs.length > 0) {
      setAllIPs(localIPs);
      setSelectedBaseUrl((prev) => prev || resolveWifiBaseUrl(localIPs));
    } else {
      fetch('/api/network-ips')
        .then((res) => res.json())
        .then((ips: { ip: string; name: string }[]) => {
          if (Array.isArray(ips)) {
            setAllIPs(ips);
            setSelectedBaseUrl((prev) => prev || resolveWifiBaseUrl(ips));
          }
        })
        .catch(() => {
          setSelectedBaseUrl((prev) => prev || window.location.origin);
        });
    }
  }, [localIPs]);

  const redUrl = selectedBaseUrl
    ? `${selectedBaseUrl}/buzzer?team=red&token=${buzzerState?.tokens?.red || ''}`
    : '';

  const blueUrl = selectedBaseUrl
    ? `${selectedBaseUrl}/buzzer?team=blue&token=${buzzerState?.tokens?.blue || ''}`
    : '';

  useEffect(() => {
    if (!redUrl || !blueUrl) return;

    QRCode.toDataURL(redUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#981f28', light: '#FFFFFF' },
    })
      .then(setQrCodeRed)
      .catch((err) => console.error('Failed to generate Red QR:', err));

    QRCode.toDataURL(blueUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#5250fc', light: '#FFFFFF' },
    })
      .then(setQrCodeBlue)
      .catch((err) => console.error('Failed to generate Blue QR:', err));
  }, [redUrl, blueUrl, buzzerState?.tokens]);

  const handleCopy = (team: Team, url: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTeam(team);
      setTimeout(() => setCopiedTeam(null), 1500);
    });
  };

  const handleRegenerate = () => {
    if (window.confirm('Regenerate QR codes? Old QR codes will stop working.')) {
      setIsRegenerating(true);
      socket?.emit('buzzer-regenerate');
      setTimeout(() => setIsRegenerating(false), 400);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Simple Header */}
        <div className="bg-[#1A1A2E] text-white px-4 py-3 flex justify-between items-center">
          <h2 className="font-bold text-base tracking-wide flex items-center gap-2">
            <span>Scan Buzzer QR</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors"
              title="Generate new QR codes for both teams"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>New QR</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Wi-Fi Network IP Pill / Selector */}
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-1.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-1.5 font-medium truncate">
            <Wifi className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-bold">Wi-Fi IP:</span>
            {allIPs.length > 1 ? (
              <select
                value={selectedBaseUrl}
                onChange={(e) => setSelectedBaseUrl(e.target.value)}
                className="bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {allIPs.map((item) => {
                  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
                  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
                  const url = `${protocol}//${item.ip}${port}`;
                  return (
                    <option key={item.ip} value={url}>
                      {item.name}: {item.ip}
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="font-mono font-bold text-indigo-950">{selectedBaseUrl}</span>
            )}
          </div>
        </div>

        {/* Team Segmented Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('red')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === 'red'
                ? 'bg-[#981f28] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                buzzerState.connectedDevices.red ? 'bg-white' : 'bg-gray-300'
              }`}
            />
            <span className="truncate">{teamNames.red}</span>
            <span className="text-[10px] opacity-80">
              {buzzerState.connectedDevices.red ? '🟢' : '⚪'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('blue')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === 'blue'
                ? 'bg-[#5250fc] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                buzzerState.connectedDevices.blue ? 'bg-white' : 'bg-gray-300'
              }`}
            />
            <span className="truncate">{teamNames.blue}</span>
            <span className="text-[10px] opacity-80">
              {buzzerState.connectedDevices.blue ? '🟢' : '⚪'}
            </span>
          </button>
        </div>

        {/* Minimal Single QR Display */}
        <div className="p-4 flex flex-col items-center justify-center bg-white">
          {activeTab === 'red' ? (
            <div className="flex flex-col items-center text-center w-full">
              <div className="p-2 rounded-xl bg-red-50 border border-red-200 mb-3 shadow-inner">
                {qrCodeRed ? (
                  <img
                    src={qrCodeRed}
                    alt={`${teamNames.red} QR`}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                    Generating...
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy('red', redUrl)}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 transition-colors"
                >
                  {copiedTeam === 'red' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <a
                  href={redUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-3 bg-[#981f28] hover:bg-red-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Test View
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center w-full">
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 mb-3 shadow-inner">
                {qrCodeBlue ? (
                  <img
                    src={qrCodeBlue}
                    alt={`${teamNames.blue} QR`}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                    Generating...
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy('blue', blueUrl)}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 transition-colors"
                >
                  {copiedTeam === 'blue' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <a
                  href={blueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-3 bg-[#5250fc] hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Test View
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
