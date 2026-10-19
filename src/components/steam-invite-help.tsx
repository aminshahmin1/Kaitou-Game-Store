"use client";
import { useState } from "react";
import { CircleHelp, ExternalLink, Link2, Users, Copy } from "lucide-react";
export function SteamInviteHelp() {
  const [open, setOpen] = useState(false);
  return <span className="group relative inline-flex shrink-0">
    <button type="button" aria-label="Where to find your Steam invite link" aria-expanded={open} aria-controls="steam-invite-guide" onClick={(event) => { event.preventDefault(); if (open) event.currentTarget.blur(); setOpen(!open); }} className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 text-sky-800"><CircleHelp className="h-5 w-5" /></button>
    <span id="steam-invite-guide" role="tooltip" className={`absolute right-0 top-11 z-20 w-72 max-w-[calc(100vw_-_3rem)] origin-top-right rounded-lg border border-slate-300 bg-white p-4 text-left text-sm font-normal text-slate-700 shadow-xl transition-[opacity,scale,visibility] duration-150 motion-reduce:transition-none ${open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0 group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100"}`}>
      <strong className="block text-slate-950">Get your Steam friend invite link</strong>
      <span className="mt-3 grid gap-3">{[{ icon: Users, text: "Open Steam, then Friends and Add a Friend." }, { icon: Link2, text: "Find the invite-link section and create a new link." }, { icon: Copy, text: "Copy the full s.team/p/ link and paste it here." }].map(({ icon: Icon, text }, index) => <span key={text} className="steam-guide-step flex gap-2 rounded-md p-2" style={{ animationDelay: `${index * 2}s` }}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><span>{text}</span></span>)}</span>
      <a href="https://steamcommunity.com/my/friends/add" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-sky-800">Open Steam friends<ExternalLink className="h-4 w-4" /></a>
      <span className="mt-3 block text-xs leading-5">Use the receiving account. We never need your password or Steam Guard code.</span>
    </span>
  </span>;
}
