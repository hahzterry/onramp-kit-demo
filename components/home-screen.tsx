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

import Image from 'next/image'
import { ActivityList } from './activity-list'
import { ArrowDownIcon, ArrowUpRightIcon, PlusIcon } from './icons'
import type { ActivityEntry } from './use-activity'

function formatBalance(balance: number) {
  const [whole, cents] = balance.toFixed(2).split('.')
  return [Number(whole).toLocaleString('en-US'), cents]
}

export function HomeScreen({
  balance = 0,
  balanceChain,
  prompt,
  activity = [],
  onAddMoney,
  addMoneyHint,
}: {
  balance?: number
  balanceChain?: string | null
  prompt?: {
    note: string
    action: string
    onAction: () => void
  } | null
  activity?: ActivityEntry[]
  onAddMoney: () => void
  addMoneyHint?: string | null
}) {
  const [whole, cents] = formatBalance(balance)

  const actions = [
    {
      icon: PlusIcon,
      label: 'Add money',
      emoji: '💸',
      primary: true,
      hint: addMoneyHint,
      hintAlign: 'left' as const,
      onClick: onAddMoney,
    },
    {
      icon: ArrowUpRightIcon,
      label: 'Send',
      emoji: '🚀',
      primary: false,
      hint: 'Coming soon',
      hintAlign: 'center' as const,
      onClick: undefined,
    },
    {
      icon: ArrowDownIcon,
      label: 'Withdraw',
      emoji: '💰',
      primary: false,
      hint: 'Coming soon',
      hintAlign: 'center' as const,
      onClick: undefined,
    },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background [scrollbar-width:none]">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 pt-7 md:pt-3">
        <div className="flex-1">
          <h1 className="font-display text-[30px] leading-[1.1] font-medium tracking-[-0.03em]">
            💰MonYuny
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Livestream Social Banking
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 shadow-[0_0_20px_rgba(0,140,255,0.08)]">
          <a
            href="https://social.monyuny.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <span className="text-[25px] leading-none" role="img" aria-label="Social">
              💬
            </span>
            <span className="text-sm font-semibold text-foreground">
              Social
            </span>
          </a>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 shadow-[0_0_20px_rgba(0,140,255,0.08)]">
          <a
            href="https://live.monyuny.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <span className="text-[25px] leading-none" role="img" aria-label="Live">
              🔴
            </span>
            <span className="text-sm font-semibold text-foreground">
              Live
            </span>
          </a>
        </div>
      </div>

      {/* Balance */}
      <div className="mt-8 px-5">
        <div className="relative overflow-hidden rounded-[24px] border border-[#008CFF]/30 bg-gradient-to-br from-[#07111f] via-[#05080d] to-black p-6 shadow-[0_0_45px_rgba(0,140,255,0.12)]">
          <div className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-[#008CFF]/15 blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Current Balance
              </p>

              <span className="rounded-full bg-[#22C55E]/10 px-2.5 py-1 text-xs font-semibold text-[#5BEF68]">
                ● Available
              </span>
            </div>

            {balanceChain && !prompt && (
              <p className="mt-1 text-xs text-muted-foreground/70">
                {balanceChain}
              </p>
            )}

            <div
              className={`mt-5 flex items-baseline gap-1 font-display tabular-nums ${
                prompt ? 'opacity-30' : ''
              }`}
            >
              <span className="text-[30px] font-medium text-[#19AFFF]">
                $
              </span>

              <span className="text-[56px] leading-none font-medium tracking-[-0.05em] text-white">
                {prompt ? '—' : whole}
              </span>

              {!prompt && (
                <span className="text-[32px] leading-none font-medium text-white/60">
                  .{cents}
                </span>
              )}
            </div>

            {!prompt && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-[#22C55E]" />
                Ready to use
              </div>
            )}

            {prompt && (
              <button
                type="button"
                onClick={prompt.onAction}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {prompt.action} →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 px-5">
        <div className="grid grid-cols-3 gap-3">
          {actions.map(
            ({ icon: Icon, label, emoji, primary, hint, hintAlign, onClick }) => (
              <div key={label} className="group relative">
                <button
                  type="button"
                  onClick={hint ? undefined : onClick}
                  aria-disabled={hint ? true : undefined}
                  className="flex w-full flex-col items-center gap-2"
                >
                  <div
                    className={`flex size-[58px] items-center justify-center rounded-[18px] border transition-all ${
                      primary
                        ? 'border-[#008CFF] bg-[#008CFF] text-white shadow-[0_0_25px_rgba(0,140,255,0.25)]'
                        : 'border-border bg-card text-[#19AFFF]'
                    } ${
                      primary && hint
                        ? 'cursor-not-allowed opacity-40'
                        : 'group-hover:scale-105'
                    }`}
                  >
                    <Icon className="size-6" strokeWidth={1.8} />
                  </div>

                  <span className="text-xs font-semibold text-muted-foreground">
                    {emoji} {label}
                  </span>
                </button>

                {hint && (
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xl group-hover:block ${
                      hintAlign === 'left'
                        ? 'left-0'
                        : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    {hint}
                  </span>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      {/* Activity divider */}
      <div className="mt-8 h-px shrink-0 bg-border" />

      {/* Activity */}
      <div className="px-5 pt-6 pb-28">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-medium tracking-tight">
              Activity ⚡
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your latest moves
            </p>
          </div>

          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            Live
          </span>
        </div>

        <ActivityList entries={activity} />
      </div>
    </div>
  )
}