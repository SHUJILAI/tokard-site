# AGENTS.md — Tokard

Rules for anyone, human or AI, who changes this project's interface.

## Brand

Everything we write and design comes from one idea. Check new copy against it.

- **Insight.** Developers outside China want China's best models, but buying them from a third party feels like a gamble: is it the real model, will it be swapped, will the bill run away?
- **Core: face value.** To take something at face value is to trust that it is what it says. On a Tokard card, what's printed is what you get.
- **Proof, and the only three claims we lean on:**
  1. The model is real: official keys issued by DeepSeek and BytePlus, never swapped.
  2. The face value is the limit: a card can't spend a cent past what's printed on it.
  3. Prices and odds are printed before you pay: you see a flip's price first, and the odds are public.
- **Tagline:** China's best AI, at face value.
- **Few brands is a stance, not a gap.** We only sell what we can stand behind. Never imply "every model" or "any key".
- **Voice:** plain, exact, a little playful. Numbers over adjectives. Short declarative sentences. Card language (face value, hand, deck, flip, deal) where it's natural, never forced. No hype words ("revolutionary", "unleash", "seamless"), no exclamation marks in page copy.

## Design

- Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.
  (避免多余的次级标签与描述，依靠布局本身来传递信息。)
- No eyebrow labels such as "01 · Section", and no captions that repeat what a number, an image or a position already says. A struck-through price needs no "was" label; a bar needs no "left" label.
- Light theme only: background `#F5F6F8`, ink `#0B0D12`, one accent, cobalt `#2340FF`. Tier colors (violet, gold) appear only on cards.
- Pixel style is for objects (the logo, card art, pips, budget bars), never for text. Headlines are Archivo set wide; reading text is Hanken Grotesk; numbers, keys and code are Geist Mono.
- The card is the product: each card is one model, one key and one hard budget.
- Motion needs a reason. Cards float and lift on hover; icons morph (Morphicons) only when their meaning changes. Respect `prefers-reduced-motion`.

## Product rules the interface must keep

- One place for each job. Flipping happens on the homepage (and in the shop's hero, so buyers never leave the shop). There is no separate Flip page: odds and rules live at `odds.html`, and your past flips live in the wallet. The old `cards.html` only forwards.

- Every day each account gets three face-down cards, one per deck (text, image, video), new at 00:00 UTC. Each can be flipped once.
- Flipping is free. The price is shown before payment, the odds are published, and there are 20 jackpots a day sitewide.
- Cards come in $5, $20 and $100. The shop discount grows with the card:
  - Coding (DeepSeek): $5 15% off, $20 20% off, $100 25% off (8.5 / 8 / 7.5折).
  - Film (Seedance 2.5, BytePlus international): $5 10% off, $20 14% off, $100 17% off (9 / 8.6 / 8.3折).
  - Design (Seedream): face value for now.
  - A refill is priced by the size of the card it fills.
- Every card size has its own pixel scene, so the three cards in a deck never look alike. The $100 scenes are the originals used on the homepage; don't change them.
- A flip takes an extra 5–20% off the shop price, so a flip always beats the shop, but never goes below cost (60% of face value). A jackpot is half the face value and capped per day.
- Any flip priced under 75% of face value (7.5折) is revealed in gold: gold light while it charges, gold foil, gold burst. Never blue for these.
- Gold within five (保底): if four flips in a row miss gold, the fifth is a Lucky card at 70% of face value (7折). Daily flips and invite flips both count; the count lives on the account and carries over between days. The flip stage shows it as five small cards, the last one gold. `PITY_EVERY` and `PITY_PRICE_RATIO` set it; the price never goes below the cost floor.
- Invites: when a friend signs up and flips their first card, the inviter gets one extra flip (3 a day at most, 10 held). Same device or a recent network of the inviter earns nothing.
- The Ultimate: for every 10,000 cards sold, one $100 card at 0.01折 ($0.10) goes into the draw. Anyone can turn it over; only an account with $20+ of real purchases (not refunded or disputed) can claim it, within 24 hours, or it goes back into the draw. One per account every 30 days. It has its own reveal (white-hot gold, prismatic foil) above gold. Stripe can't charge $0.10, so a qualifying claim is issued without checkout.
- A card's key is an original official key (原厂官key) issued by DeepSeek or BytePlus. The customer calls the provider directly, at its own base URL and with its own model ID; Tokard is not in the request path. Docs, code samples and the wallet must show the official base URL and model ID (DeepSeek: `https://api.deepseek.com`, `deepseek-flash`; BytePlus ModelArk: `https://ark.ap-southeast.bytepluses.com/api/v3`). On the card itself, say "Official DeepSeek API" or "Official BytePlus API".
