# UZDONATE brand system

The interlocking UD mark is the shared identity for the app, website, Telegram Mini App and bot. Use the editable source at `mobile/assets/branding/brand-mark.svg`; do not substitute a lightning bolt, a single letter or the old text-heavy profile image.

## Color and shape

- Ink `#0A0D15`: dark backgrounds and the launcher icon.
- Azure `#387BFF`: primary actions and the D in the monogram.
- Ice `#46DCEF`: small highlights, selected icon details and the wordmark accent.
- White `#F5F8FF`: primary text on dark backgrounds and the U in the monogram.

Use neutral layered surfaces and clear text contrast. Keep game artwork recognizable. The identity belongs in navigation, launch screens, avatars and support content, rather than as a watermark over game artwork. Rounded rectangles and consistent line icons should make controls recognizable across platforms.

## Motion

Use short transitions for taps, selection, sheets and page entrances. Animate opacity and transforms, and honor reduced-motion settings. Avoid constant pulsing, spinning decoration and delayed access to the catalog. Loading indicators should communicate work in progress.

## Exports

`scripts/generate-brand-assets.mjs` derives the launcher, adaptive foreground/background, splash, profile, favicon and Telegram card from the editable mark. It needs the `sharp` package in the development toolchain; `UZDONATE_SHARP_PATH` can point to an existing module installation. The generated native PNGs are checked into `mobile/assets/branding/` so building the application does not require Sharp.

After changing the mark:

1. Run the export script.
2. Run `dart run flutter_launcher_icons` and `dart run flutter_native_splash:create` from `mobile/`.
3. Run `node scripts/prepare-superapp.mjs` before building the website.
4. Check the mark at favicon and launcher sizes, in light/dark UI, and inside Telegram's circular profile crop.

`brand-profile.png` is the square profile/launcher export. `brand-bot-card.png` is the landscape welcome image. The bot's caption carries the localized instructions; the image has no delivery-time or price claims.

## Release copy

The brand line is **O'yiningiz bilan birga.** Write UZDONATE consistently. Describe the actual action and show the order status. Avoid claims such as guaranteed instant delivery, lowest prices, or support availability that have not been verified operationally.
