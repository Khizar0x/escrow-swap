import { ShieldOff, Scale, Link2 } from "lucide-react";

const CARDS = [
  {
    icon: ShieldOff,
    iconBg: "bg-[rgba(160,255,195,0.1)]",
    iconColor: "text-[#a0ffc3]",
    title: "No Counterparty Default",
    body: "Maker deposits are locked directly into a unique Program Derived Address. Assets can only leave the vault via an atomic take_offer, or be reclaimed by the maker via cancel_offer.",
    footLabel: "Vault Authority",
    footValue: "Offer PDA",
  },
  {
    icon: Scale,
    iconBg: "bg-[rgba(216,185,255,0.1)]",
    iconColor: "text-[#d8b9ff]",
    title: "Fixed Terms, No Slippage",
    body: "Amounts are fixed the moment an offer is created and stored on-chain. There's no pool, no price impact, and no way for either side to move the rate after the fact.",
    footLabel: "Rate",
    footValue: "Fixed at creation",
  },
  {
    icon: Link2,
    iconBg: "bg-[rgba(117,209,255,0.1)]",
    iconColor: "text-[#75d1ff]",
    title: "Atomic by Construction",
    body: "take_offer performs both transfers in one instruction: payment to the maker and delivery from the vault. If either CPI fails, Solana reverts the entire transaction, so a taker can never pay without receiving.",
    footLabel: "Settlement",
    footValue: "Single transaction",
  },
];

export function ExplainerSection() {
  return (
    <div className="flex gap-[24px] items-start justify-center w-full pb-[24px] flex-wrap">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-[#191c22] flex flex-col items-start justify-between p-[24px] rounded-[16px] flex-1 min-w-[300px]"
          >
            <div className="flex flex-col gap-[4px] items-start w-full">
              <div
                className={`${card.iconBg} flex items-center justify-center rounded-[12px] size-[40px] mb-[8px]`}
              >
                <Icon size={18} className={card.iconColor} />
              </div>
              <h3 className="font-semibold text-[#e1e2eb] text-[20px] tracking-[-0.2px]">
                {card.title}
              </h3>
              <p className="text-[#cec2d8] text-[12px] leading-[19.5px]">
                {card.body}
              </p>
            </div>
            <div className="flex items-center justify-between pt-[16px] w-full mt-[12px] border-t border-[#272a31]">
              <span className="font-mono text-[#978da1] text-[11px]">
                {card.footLabel}
              </span>
              <span className="font-mono text-[#a0ffc3] text-[11px]">
                {card.footValue}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
