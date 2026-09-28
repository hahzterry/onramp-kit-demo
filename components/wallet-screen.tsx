/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use client'

import { useEffect, useState } from 'react'
import detectEthereumProvider from '@metamask/detect-provider'
import { CopyIcon, WalletIcon } from './icons'

const BUTTON =
  'inline-flex h-14 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding bg-secondary px-4 text-base font-semibold whitespace-nowrap text-secondary-foreground transition-all outline-none select-none hover:bg-[color-mix(in_oklch,var(--color-secondary),var(--color-foreground)_5%)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px'

export function WalletScreen({
  address,
  onConnect,
  onDisconnect,
}: {
  address: string | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  // Timestamped rather than boolean, so a second click while the tooltip is
  // still up restarts the timer instead of doing nothing.
  const [copiedAt, setCopiedAt] = useState(0)

  // Connection error shown inline instead of an alert box, so the UI stays
  // consistent with the rest of the screen.
  const [connectError, setConnectError] = useState('')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!copiedAt) return
    const id = setTimeout(() => setCopiedAt(0), 1500)
    return () => clearTimeout(id)
  }, [copiedAt])

  const copy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAt(Date.now())
    } catch {
      // Clipboard access can be denied outright. Nothing to say about it.
    }
  }

  // ⚠️ MetaMask detection must happen BEFORE calling onConnect, because
  // onConnect assumes window.ethereum exists. Without this check, clicking
  // the button on a browser without MetaMask produces an unhelpful
  // "MetaMask not detected" error from deep inside the wallet library.
  //
  // mustBeMetaMask: true is important — other extensions (Phantom,
  // Coinbase Wallet, Trust) also inject window.ethereum, and we do not
  // want to hand their provider to a MetaMask-specific connect flow.
  const handleConnect = async () => {
    setConnectError('')
    setConnecting(true)
    try {
      const provider = await detectEthereumProvider({ mustBeMetaMask: true })
      if (!provider) {
        setConnectError(
          'MetaMask is not detected. Install it from metamask.io, or open this page inside the MetaMask mobile app.',
        )
        return
      }
      onConnect()
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : 'Unable to detect MetaMask.',
      )
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-28 [scrollbar-width:none]">
      <div className="pt-10 md:pt-6">
        <h1 className="font-display text-[30px] leading-[1.2] font-light tracking-[-0.01em]">
          Wallet
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {address
            ? 'USDC you buy is delivered to this address.'
            : 'Connect a wallet to continue purchasing stablecoins.'}
        </p>
      </div>

      {address ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary py-3.5 pr-2.5 pl-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-tight text-muted-foreground">
                Address
              </p>
              <p className="mt-1 truncate font-mono text-sm text-secondary-foreground">
                {address}
              </p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={copy}
                aria-label="Copy address"
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--color-secondary),var(--color-foreground)_5%)] hover:text-secondary-foreground"
              >
                <CopyIcon className="size-[18px]" />
              </button>
              {copiedAt > 0 && (
                <span
                  role="status"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-md bg-card px-3 py-1.5 text-xs whitespace-nowrap text-foreground ring-1 ring-border"
                >
                  Copied
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onDisconnect} className={BUTTON}>
            Disconnect
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className={`mt-6 ${BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <WalletIcon className="size-[18px]" strokeWidth={2} />
            {connecting ? 'Connecting…' : 'Connect MetaMask'}
          </button>

          {connectError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {connectError}
            </p>
          )}
        </>
      )}
    </div>
  )
}