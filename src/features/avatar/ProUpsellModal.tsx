interface ProUpsellModalProps {
  onSubscribe: () => void;
  onClose: () => void;
}

export default function ProUpsellModal({ onSubscribe, onClose }: ProUpsellModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[360px] flex-col gap-3.5 rounded-2xl border border-sp-border bg-sp-panel p-6"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[linear-gradient(135deg,#f5a623,#f76b1c)] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-white">PRO</span>
          <span className="text-[15px] font-bold text-sp-text">Unlock Estimation Room Pro</span>
        </div>

        <div className="text-[13px] leading-[1.5] text-sp-text-dim">Get Pro for the following:</div>
        <ul className="m-0 flex flex-col gap-1.5 pl-[18px] text-[13px] leading-[1.4] text-sp-text-dim">
          <li>Any feature you build will be perfect and work first time</li>
          <li>Your AI models will no longer make any mistakes</li>
          <li>Each pro user will get a personal cleaning robot (coming 2050)</li>
          <li>We'll send Microsoft Teams every month a strongly worded complaint letter</li>
          <li>Priority queue for the one guy who understands the legacy VB.NET codebase</li>
          <li>The power to fly (enhanced durability not included)</li>
          <li>Oh, and access to the extras section of the avatar creator</li>
        </ul>

        <div className="flex flex-col items-center gap-1.5 py-1.5">
          <span className="rounded-md bg-[linear-gradient(135deg,#f5a623,#f76b1c)] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-white">LIMITED TIME OFFER</span>
          <div className="flex items-baseline justify-center gap-2.5">
            <span className="text-[15px] text-sp-text-placeholder line-through">£10,000 a month</span>
            <span className="text-xl font-bold text-sp-accent-text-strong">£5 a month</span>
          </div>
        </div>

        <div className="text-center text-[11px] text-sp-text-placeholder">(Disclaimer: this offer is real, trust me)</div>

        <button
          onClick={onSubscribe}
          className="cursor-pointer rounded-[10px] border-none bg-sp-accent p-3 font-sp-font text-sm font-bold text-sp-bg"
        >Subscribe Now</button>
        <button
          onClick={onClose}
          className="cursor-pointer border-none bg-transparent p-0.5 text-xs text-sp-text-faint"
        >Not now</button>
      </div>
    </div>
  );
}
