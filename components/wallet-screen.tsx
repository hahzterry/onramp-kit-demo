'use client'

import { useEffect, useState } from 'react'
import { createEVMClient } from '@metamask/connect-evm'
import { CopyIcon, WalletIcon } from './icons'

const BUTTON =
  'inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-transparent bg-clip-padding bg-secondary px-4 text-base font-semibold whitespace-nowrap text-secondary-foreground transition-all outline-none select-none hover:bg-[color-mix(in_oklch,var(--color-secondary),var(--color-foreground)_5%)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px'

function shortenAddress(address: string) {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletScreen({
  address,
  onConnect,
  onDisconnect,
}: {
  address: string | null
  onConnect: (address: string) => void
  onDisconnect: () => void
}) {
  const [copiedAt, setCopiedAt] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evmClient, setEvmClient] = useState<Awaited<ReturnType<typeof createEVMClient>> | null>(null)

  // Initialize the MetaMask Connect EVM client once on mount.
  // ⚠️ createEVMClient returns a Promise — it MUST be awaited.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const client = await createEVMClient({
          dapp: {
            name: 'Monyuny Onramp',
            url: window.location.href,
          },
          api: {
            supportedNetworks: {
              // Arc Testnet — Chain ID 5042002 = 0x4CEF52
              '0x4CEF52': 'https://rpc.testnet.arc.io',
            },
          },
        })

        if (cancelled) return
        setEvmClient(client)

        const provider = client.getProvider()
        provider.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            onDisconnect()
          } else if (accounts[0]) {
            onConnect(accounts[0])
          }
        })
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to initialize MetaMask.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [onConnect, onDisconnect])

  useEffect(() => {
    if (!copiedAt) return
    const id = setTimeout(() => setCopiedAt(0), 1500)
    return () => clearTimeout(id)
  }, [copiedAt])

  const connectMetaMask = async () => {
    setError(null)

    if (!evmClient) {
      setError('MetaMask is still loading. Please wait a moment and try again.')
      return
    }

    try {
      setConnecting(true)

      // ⚠️ connect() returns { accounts, chainId } — not a raw array.
      // Pass chainIds as hex strings. Arc Testnet is 0x4CEF52.
      const { accounts } = await evmClient.connect({
        chainIds: ['0x4CEF52'],
      })

      if (!accounts || !accounts[0]) {
        throw new Error('No MetaMask account was returned.')
      }

      onConnect(accounts[0])
    } catch (err: any) {
      const message =
        err instanceof Error ? err.message : 'MetaMask connection failed.'

      if (err?.code === 4001 || message.toLowerCase().includes('user rejected')) {
        setError('Connection cancelled.')
      } else {
        setError(message)
      }
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (evmClient) {
      try {
        await evmClient.disconnect()
      } catch {
        // Ignore — local state is cleared regardless.
      }
    }
    onDisconnect()
  }

  const copy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAt(Date.now())
      setError(null)
    } catch {
      setError('Could not copy the wallet address.')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background px-6 pb-28 [scrollbar-width:none]">
      <div className="pt-10 md:pt-6">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl border border-[#008CFF]/30 bg-[#008CFF]/10 text-[#19AFFF]">
          <WalletIcon className="size-7" strokeWidth={1.7} />
        </div>

        <h1 className="font-display text-[30px] leading-[1.2] font-medium tracking-[-0.03em]">
          Wallet 👛
        </h1>

        <p className="mt-2 max-w-sm text-base leading-relaxed text-muted-foreground">
          Connect your wallet to receive the money you buy.
        </p>
      </div>

      {address ? (
        <div className="mt-7 flex flex-col gap-4">
          <div className="overflow-hidden rounded-[22px] border border-[#22C55E]/30 bg-[#22C55E]/5">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15">
                <span className="text-xl">🟢</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#5BEF68]">
                  Connected
                </p>
                <p className="mt-1 truncate font-mono text-sm text-foreground">
                  {shortenAddress(address)}
                </p>
              </div>
            </div>
            <div className="border-t border-[#22C55E]/15 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                USDC you buy will be delivered to this wallet.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                Wallet address
              </p>
              <p className="mt-1 truncate font-mono text-sm text-foreground">
                {address}
              </p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={copy}
                aria-label="Copy wallet address"
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-95"
              >
                <CopyIcon className="size-[18px]" />
              </button>
              {copiedAt > 0 && (
                <span
                  role="status"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs whitespace-nowrap text-foreground shadow-xl"
                >
                  Copied ✓
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-[#FF3B5C]/30 bg-[#FF3B5C]/10 px-4 py-3">
              <p className="text-sm text-[#FF8095]">{error}</p>
            </div>
          )}

          <button type="button" onClick={disconnect} className={BUTTON}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-4">
          <div className="rounded-[22px] border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#F6851B]/10 text-3xl">
                🦊
              </div>
              <div>
                <p className="font-semibold text-foreground">MetaMask</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your wallet. Your money.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={connectMetaMask}
            disabled={connecting || !evmClient}
            className={`${BUTTON} ${
              connecting || !evmClient
                ? 'cursor-wait opacity-60'
                : 'bg-[#008CFF] text-white shadow-[0_0_30px_rgba(0,140,255,0.2)] hover:bg-[#19AFFF]'
            }`}
          >
            {connecting ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Connecting...
              </>
            ) : (
              <>
                <span className="text-lg">🦊</span>
                Connect MetaMask
              </>
            )}
          </button>

          {error && (
            <div className="rounded-2xl border border-[#FF3B5C]/30 bg-[#FF3B5C]/10 px-4 py-3">
              <p className="text-sm leading-relaxed text-[#FF8095]">{error}</p>
            </div>
          )}

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Your wallet stays yours. Your keys stay yours. 🔐
          </p>
        </div>
      )}
    </div>
  )
}