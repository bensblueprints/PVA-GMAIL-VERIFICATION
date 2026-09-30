# PVA Gmail verification pricing

Verification costs in USD, imported from the supplied pricing list on September 30, 2026. The complete catalog is in [pricing.json](pricing.json). This repository contains pricing data and documentation; it does not send SMS messages or process payments.

## Gmail verification costs

| Service | Cost per number with a received SMS code | 10 charged numbers | 100 charged numbers |
| --- | ---: | ---: | ---: |
| Google/YouTube/Gmail | $1.30 | $13.00 | $130.00 |
| Google/YouTube/Gmail Reset | $0.45 | $4.50 | $45.00 |
| Gmail/Google/Canada | $0.30 | $3.00 | $30.00 |

Choose the rate for the requested service and country. Standard Gmail verification uses **$1.30**; the reset and Canada listings have their own rates.

## When a charge applies

You are charged for a number once you receive its SMS code. If the number is not used before its time limit, the money is refunded to your account balance and can be used for another service or number.

For budgeting, “cost per text” means the listed cost for a number that receives an SMS code. A sent text or an attempted verification alone does not trigger the charge described in the supplied policy. Outbound SMS fees and prices for additional codes on the same number are not specified.

```text
Total cost in cents = sum(rate in cents × charged numbers for each service)
```

For example, if 10 standard Gmail numbers receive codes and 2 other numbers expire unused, the final cost after the unused-number refunds is **$13.00**. An unused number's temporary balance reservation is not part of that final cost.

## Using the pricing data

Each service has an internal `id`, its original display `name`, and an integer `price_cents`. Use the ID to distinguish listings and keep arithmetic in cents. These IDs are catalog identifiers, not provider API service codes.

```python
import json
from pathlib import Path

catalog = json.loads(Path("pricing.json").read_text(encoding="utf-8"))
rates = {service["id"]: service["price_cents"] for service in catalog["services"]}

charged_numbers = 10
total_cents = rates["google-youtube-gmail"] * charged_numbers
print(f"${total_cents // 100}.{total_cents % 100:02d}")  # $13.00
```

The catalog records the supplied billing policy as metadata. An application consuming it must implement its own billing and refund handling.

## Source details

- The repeated full pricing block and identical Walmart $0.30 entry were included once.
- Google Chat appears at $0.39 and $0.33; Walmart appears at $0.30 and $0.40. Both prices are retained with `variant_unspecified: true` because the source does not identify the differences. Confirm the intended listing before using either service's rate.
- The supplied comparison table lists different rates, including Google $0.40 and OpenAI $0.05. The detailed service list is used for this catalog, including Google/YouTube/Gmail $1.30 and ChatGPT $0.12.
- This is a snapshot of the supplied rates, not a live provider quote. The prices have not been independently verified.

## All verification prices

All amounts below are USD per number with a received SMS code. “Unspecified variant” identifies the conflicting same-name listings described above.

<!-- pricing-table:start -->
| Service | Cost (USD) |
| --- | ---: |
| WhatsApp Call/SMS | $1.55 |
| WhatsApp Canada | $0.60 |
| Telegram | $0.88 |
| Telegram Canada | $0.50 |
| Google Chat (unspecified variant) | $0.39 |
| Google Messenger | $0.48 |
| Google Voice | $0.36 |
| Google/YouTube/Gmail | $1.30 |
| Google Chat (unspecified variant) | $0.33 |
| Google/YouTube/Gmail Reset | $0.45 |
| Gmail/Google/Canada | $0.30 |
| Facebook | $0.80 |
| Facebook Reset | $0.45 |
| Yahoo | $0.20 |
| Instagram / Threads | $0.35 |
| Instagram | $0.20 |
| Instagram Canada | $0.25 |
| X / Twitter | $0.22 |
| Tiktok | $0.20 |
| TikTok Reset | $0.22 |
| Netflix | $0.12 |
| AWS Amazon | $0.06 |
| Amazon | $0.30 |
| Microsoft | $0.08 |
| Apple | $0.12 |
| Discord | $0.12 |
| Snapchat | $0.12 |
| Snapchat Reset | $0.25 |
| LinkedIn | $0.12 |
| Uber | $0.11 |
| PayPal | $0.55 |
| 7-Eleven | $0.12 |
| AARP | $0.42 |
| AI Student Pack | $0.30 |
| AOL | $0.12 |
| Adobe | $0.12 |
| Airbnb | $0.18 |
| Airtel | $0.18 |
| AliExpress | $0.48 |
| Alibaba | $0.14 |
| Ashley Madison | $0.24 |
| AttaPoll | $0.24 |
| AutoTrader | $0.06 |
| BIGO Live | $0.60 |
| BLK | $0.24 |
| BOTIM | $0.18 |
| Badoo | $0.18 |
| Baselane | $0.12 |
| Battle.net / Blizzard | $0.08 |
| Bilibili | $0.18 |
| Bingo Stars | $0.12 |
| BitClout | $0.24 |
| BlaBlaCar | $0.18 |
| Bolt | $0.18 |
| Bumble | $0.22 |
| Burner | $0.12 |
| Capital One Shopping | $0.06 |
| Careem | $0.42 |
| Carousell | $0.30 |
| Chalkboard | $0.12 |
| ChargePoint | $0.60 |
| ChatGPT | $0.12 |
| Chispa | $0.19 |
| Claude | $0.24 |
| CloudBet | $0.23 |
| CloudChat | $0.07 |
| Clubhouse | $0.24 |
| Coca-Cola | $0.18 |
| College Pulse | $0.24 |
| Copper | $0.12 |
| Craigslist | $0.20 |
| CrowdTap | $0.24 |
| Curtsy | $0.30 |
| DIDI / 滴滴出行 | $0.24 |
| Deliveroo | $0.12 |
| Depop | $0.24 |
| DoorDash | $0.18 |
| Douyin | $0.07 |
| Dutch Bros | $0.12 |
| Etsy | $0.24 |
| Fashion Nova | $0.12 |
| Feabie | $0.12 |
| FedEx | $0.24 |
| Feeld | $0.18 |
| Fetlife | $0.30 |
| Fliff | $0.08 |
| Flip | $0.12 |
| Flipkart | $0.24 |
| Foodora | $0.12 |
| Foodpanda | $0.24 |
| Freelancer | $0.18 |
| Freenow | $0.18 |
| GasBuddy | $0.08 |
| Gemini | $0.24 |
| Getir | $0.24 |
| Gett | $0.24 |
| Glovo | $0.12 |
| Grab | $0.24 |
| Grailed | $0.24 |
| Grammarly | $0.12 |
| Grindr | $0.06 |
| GroupMe | $0.06 |
| Happn | $0.30 |
| Haraj | $0.24 |
| Her | $0.36 |
| Hily | $0.12 |
| Hinge | $0.25 |
| Hopp | $0.12 |
| Idealista | $0.24 |
| Imo | $0.06 |
| Indeed | $0.12 |
| Instacart | $0.12 |
| Ipsos iSay | $0.18 |
| JDcom | $0.18 |
| JustDating | $0.24 |
| Kaggle | $0.18 |
| KakaoTalk | $0.24 |
| Lazada | $0.24 |
| Likee | $0.30 |
| Line messenger | $0.60 |
| LoveAndSeek | $0.12 |
| Lyft | $0.08 |
| Mamba | $0.24 |
| Manus | $0.11 |
| Match | $0.12 |
| Michat | $0.07 |
| Mocospace | $0.24 |
| My11Circle | $0.18 |
| Myntra | $0.24 |
| NCsoft | $0.24 |
| Naver | $0.06 |
| Nextdoor | $0.12 |
| NiftyGateway | $0.24 |
| Nike | $0.12 |
| NoBroker | $0.24 |
| OPPO | $0.48 |
| OffGamers | $0.18 |
| OkCupid | $0.12 |
| Service not listed | $2.08 |
| OurTime | $0.12 |
| Pinduoduo | $0.18 |
| Plenty Of Fish | $0.11 |
| Poshmark | $0.24 |
| ProtonMail | $0.36 |
| Pulsz | $0.24 |
| Rapido | $0.18 |
| Rappi | $0.12 |
| Razer | $0.24 |
| Rebtel | $0.60 |
| Redbubble | $0.08 |
| Reddit | $0.42 |
| Roblox | $0.06 |
| Rumble | $0.24 |
| Rummy gold | $0.24 |
| RummyLoot | $0.24 |
| Sahibinden | $0.24 |
| Samsung | $0.18 |
| Shein | $0.42 |
| Shopee | $0.24 |
| Signal | $0.11 |
| SignalHire | $0.12 |
| Skout | $0.24 |
| Slips | $0.12 |
| Smitten | $0.24 |
| Speedway | $0.12 |
| Steam | $0.30 |
| Stir | $0.12 |
| Subito | $0.30 |
| Super.com | $0.24 |
| Sweetring | $0.30 |
| Swiggy | $0.24 |
| Talabat | $0.07 |
| Tango | $0.18 |
| Tantan | $0.18 |
| Taobao | $0.18 |
| TapTap | $0.12 |
| Temu | $0.18 |
| Tencent QQ | $0.18 |
| TextFree | $0.12 |
| Threads | $0.05 |
| Ticketmaster | $0.30 |
| Tinder | $0.17 |
| Tixel | $0.12 |
| Trendyol | $0.24 |
| Truecaller | $0.24 |
| Truth Social | $0.08 |
| Twilio | $0.12 |
| Twitch | $0.12 |
| Ubisoft | $0.24 |
| Uklon | $0.24 |
| Upward | $0.12 |
| Upwork | $0.18 |
| VK | $0.22 |
| Vercel | $0.05 |
| Vinted | $0.18 |
| Vivo | $0.24 |
| Voloco | $0.12 |
| Walmart (unspecified variant) | $0.30 |
| WeChat | $0.15 |
| Weibo | $0.18 |
| WhatNot | $0.12 |
| Whoosh | $0.24 |
| Wildberries | $0.24 |
| Wolt | $0.08 |
| Wonder | $0.11 |
| Yalla | $0.48 |
| Yik Yak | $0.12 |
| Zalo | $0.24 |
| Zoho | $0.18 |
| cleartrip | $0.24 |
| eBay | $0.08 |
| iPlum | $0.07 |
| Viber | $0.18 |
| Wells Fargo | $1.30 |
| MoneyLion | $0.50 |
| Bank Of America | $0.60 |
| CashApp | $0.50 |
| Chime | $0.60 |
| Walmart (unspecified variant) | $0.40 |
| Acima | $0.12 |
| Truist Bank | $0.50 |
| Venmo | $0.50 |
| Zillow | $0.20 |
| Bandai | $0.05 |
| BlackPeople | $0.24 |
| Caddy | $0.06 |
| Caesars | $0.06 |
| Cursor | $0.12 |
| Fiverr | $0.12 |
| Hard Rock | $0.12 |
| Kimi | $0.12 |
| NVIDIA | $0.12 |
| Neon | $0.06 |
| Perplexity | $0.12 |
| Polymarket | $0.12 |
| Seated | $0.06 |
| Shopify | $0.12 |
| Tierlock | $0.12 |
| Triumph | $0.06 |
| Zoom | $0.12 |
| github | $0.23 |
<!-- pricing-table:end -->
