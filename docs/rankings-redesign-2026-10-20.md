# Rankings and currency-rain release

- Rankings follows the saved site theme with dedicated light/dark surface, text, borders, medals, navigation and footer colors. One horizontally scrolling game strip replaces wrapping long labels. Native swipe/trackpad, previous/next buttons, keyboard links and selected-game visibility; no fake ARIA tab semantics for page navigation. Compact visual names preserve the existing full game/region/unit identity in URLs and accessible labels. No player grouping or historical totals changed.
- Private currency_leaderboard RPC now returns up to 100 players per game/unit instead of 25; removes the former 500-row global cap. Same completed, paid, non-test and non-refunded currency-only aggregation and private grants. Page also caps selected rows at 100. No fake players added to public boards.
- Product poster areas have nine lightweight currency particles each, using the corresponding game's real currency artwork. CSS transform/opacity loops, clipped to artwork area, no pointer interception and no change to card dimensions or purchasing. Reduced-motion hides the effect. No paid video generation, external animation service or new dependency required.

## Artwork sources

Small currency artwork used to identify the games being sold, not an assertion of publisher affiliation. Publisher trademarks/artwork remain with their respective owners; third-party availability does not establish a commercial license. Reuse permission should be confirmed with publishers/supplier branding terms. Local source files are tracked; no third-party image requests at runtime.

- Genesis Crystal (not Primogem): https://enka.network/ui/UI_ItemIcon_203.png ; identification: https://genshin-impact.fandom.com/wiki/Genesis_Crystal
- Mobile Legends Diamond: https://liquipedia.net/commons/images/2/2f/Mobile_Legends_Diamond_icon.png ; source index: https://liquipedia.net/mobilelegends/Module:MatryoshX/sandbox4
- Free Fire Diamonds: https://www.daddytopup.com/storage/products/01KB7K1S889TJ574S1MB22B5PD.png ; page https://www.daddytopup.com/games/free-fire-khmysg
- PUBG UC: https://admin.apeakgaming.com/storage/media/Zb4C3mQ2WKpw1BFJ6HjAGFz3QVrfhfG9Ehznp6j1.png ; page https://apeakgaming.com/products/topup-pubg-mobile
- Wuthering Waves Lunite: https://s3.ap-southeast-1.amazonaws.com/sg-pay-static-apse1/pay/jolly-admin/prod/app-goods/980%2B110_compressed20250429064414467.png ; page https://www.jollymax.com/ph/wuthering-waves

Rejected preview images with baked checkerboards or unrelated characters. All final assets visually inspected before release.

## Verification

- Unit tests pass for the compact game/currency mapping and original identity/pack exclusions. TypeScript, scoped ESLint and Vercel production build pass.
- Rollback SQL inserted 105 fixture players in each of two games, verified exactly the highest 100 per game and private RPC permissions, then rolled back. Separate query confirms zero fixture orders remain. No real order, payment or supplier delivery created; existing totals/identities untouched.
- Eight isolated browser cases (320/390/1024/1440px, both themes) pass: no tab overlap or page overflow, single-row strip, arrows when content genuinely overflows, valid currency images, correct theme/footers. Test distinguishes harmless one-pixel scroll rounding from meaningful overflow; desktop arrows correctly disable when all games fit. Added per-link resize observation so font changes update edge states. Visual inspection caught and fixed the shared footer retaining its light background on the new dark surface.
- Additional game selection, selected state, masked populated ranking, theme toggle, actual changing particle transforms, reduced-motion disabling, mobile card layout and normal product-card navigation pass. Screenshots inspected for desktop populated rankings and the cards. Reports/screenshots ignored under artifacts/rankings-design.
- LIVE: deployment dpl_2wdfZ1Qf9UrnTkSMrYENUrimAL27 promoted to kaitou.shop. The complete browser script also passed on the live domain: eight width/theme cases, game selection, masked populated ranking, theme toggle, currency images/motion, reduced motion and card navigation; zero uncaught errors and zero paid orders. No dependencies or credentials added. Security advisor remains unchanged: private default-denial tables intentionally have no public RLS policy; pre-existing pg_net/public warning remains (https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
