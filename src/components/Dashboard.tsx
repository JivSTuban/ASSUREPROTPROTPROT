import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { balance } = useWallet()
  const [balanceVisible, setBalanceVisible] = useState(true)

  const services = [
    { name: 'Send', icon: '📤' },
    { name: 'Load', icon: '📱' },
    { name: 'Transfer', icon: '🏦' },
    { name: 'Bills', icon: '📄' },
    { name: 'Borrow', icon: '🤝' },
    { name: 'GSave', icon: '🐷' },
    { name: 'Ginsure', icon: '🛡️' },
    { name: 'GInvest', icon: '🌱' },
    { name: 'GLife', icon: '🛒' },
    { name: 'A+ Rewards', icon: '🎁' },
    { name: 'GForest', icon: '🌿' },
    { name: 'GAssure', icon: '🔒' },
  ]

  const handleServiceClick = (serviceName: string) => {
    if (serviceName === 'GAssure') {
      navigate('/escrow')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E6F0FF] via-[#F9FAFB] to-[#FFFFFF] text-[#1A1A1A]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Phone Device Container */}
        <div className="relative flex w-full h-full flex-col rounded-[32px] border-[3px] border-black bg-white shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
          {/* Notch */}
          <span className="pointer-events-none absolute left-1/2 top-0 h-6 w-32 -translate-x-1/2 transform rounded-b-3xl bg-[#1A1A1A]/90 z-10" />
          
          {/* Status Bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-2 bg-white rounded-t-[29px]">
            <span className="text-sm font-semibold text-black">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 4h12v1H2V4zm0 3h12v1H2V7zm0 3h8v1H2v-1z"/>
              </svg>
              <svg className="w-3 h-4 ml-1" viewBox="0 0 12 16" fill="currentColor">
                <path d="M1 4h10v8H1V4zm-1 0a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H1a1 1 0 01-1-1V4zm5 10h2v1H5v-1z"/>
              </svg>
              <svg className="w-6 h-4 ml-1" viewBox="0 0 24 16" fill="currentColor">
                <path d="M2 2h20v12H2V2zm-2 0a2 2 0 012-2h20a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm20 3v6h2V5h-2z"/>
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="bg-[#0066FF] px-6 py-4 rounded-b-3xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md">
                  <span className="text-xl font-bold text-[#0066FF]">G</span>
                </div>
                <span className="text-lg font-semibold text-white">Hello!</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/30 backdrop-blur-sm">
                  HELP
                </button>
              </div>
            </div>

            {/* Available Balance - Moved inside header */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/80">
                    Available Balance
                  </span>
                  <button
                    onClick={() => setBalanceVisible(!balanceVisible)}
                    className="text-white/80 hover:text-white text-lg"
                  >
                    {balanceVisible ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-between">
                {balanceVisible ? (
                  <p className="text-3xl font-bold text-white">
                    ₱ {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                ) : (
                  <p className="text-3xl font-bold text-white">₱ ••••••</p>
                )}
                <button className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0066FF] shadow-md hover:shadow-lg transition-shadow">
                  <span className="text-base">+</span>
                  Cash In
                </button>
              </div>
            </div>
          </div>

              {/* Services Grid */}
          <div className="px-6 py-6 flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4">
              {services.map((service) => (
                <button
                  key={service.name}
                  onClick={() => handleServiceClick(service.name)}
                  className="relative flex flex-col items-center gap-2 rounded-xl p-2 transition hover:bg-gray-50 active:scale-95"
                >
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF]/10 to-[#0066FF]/5 text-2xl shadow-sm">
                    {service.icon}
                    {service.name === 'GAssure' && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-gradient-to-r from-red-500 to-pink-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md animate-pulse">
                        New
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">{service.name}</span>
                </button>
              ))}
            </div>

            {/* View All Services */}
            <div className="mt-6 text-center">
              <button className="text-sm font-semibold text-[#0066FF] hover:text-[#0052CC]">View All Services</button>
            </div>

            {/* Mega Deals Banner */}
            <div className="mt-6">
              <h3 className="mb-4 text-base font-bold text-gray-900">Mega Deals</h3>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0066FF] via-[#0052CC] to-[#003D99] p-6 shadow-xl">
                <div className="relative z-10">
                  <div className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3">
                    <span className="text-xs font-bold text-white">LIMITED OFFER</span>
                  </div>
                  <p className="text-3xl font-bold text-white mb-2">Get 6%</p>
                  <p className="text-sm text-white/90 mb-4">Cashback on your next purchase</p>
                  <button className="bg-white text-[#0066FF] px-5 py-2 rounded-full text-sm font-bold shadow-lg hover:shadow-xl transition-shadow">
                    Shop Now
                  </button>
                </div>
                <div className="absolute right-0 top-0 h-full w-40 opacity-20">
                  <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-white/30 blur-2xl"></div>
                  <div className="absolute right-8 bottom-8 h-32 w-32 rounded-full bg-white/20 blur-3xl"></div>
                </div>
                {/* Decorative image placeholder */}
                <div className="absolute right-4 bottom-4 h-32 w-32 bg-white/10 rounded-2xl backdrop-blur-sm"></div>
              </div>
            </div>

            {/* Extra padding for bottom nav */}
            <div className="h-20"></div>
          </div>

          {/* Bottom Navigation */}
          <div className="border-t border-gray-200 bg-white rounded-b-[29px]">
            <div className="flex items-center justify-around px-4 py-3">
              <button className="flex flex-col items-center gap-1.5 min-w-[60px] hover:scale-105 transition-transform">
                <svg className="h-6 w-6 text-[#0066FF]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                <span className="text-[10px] font-semibold text-[#0066FF]">Home</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 min-w-[60px] hover:scale-105 transition-transform">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span className="text-[10px] font-medium text-gray-500">Inbox</span>
              </button>
              <button className="flex flex-col items-center gap-1 -mt-4 hover:scale-105 transition-transform">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#0066FF] to-[#0052CC] shadow-lg">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-[#0066FF]">QR</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 min-w-[60px] hover:scale-105 transition-transform">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <span className="text-[10px] font-medium text-gray-500">Activity</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 min-w-[60px] hover:scale-105 transition-transform">
                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span className="text-[10px] font-medium text-gray-500">Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

