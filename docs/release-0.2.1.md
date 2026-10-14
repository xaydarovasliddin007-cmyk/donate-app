# UZDONATE 0.2.1

Release date: 14 October 2026. Android version code: 3.

The entrance restores the original orbit and light treatment around the shared UD mark. The website and Telegram Mini App use a finite 1.84-second sequence with layered orbit arcs, a light sweep, staggered letters and a soft handoff into the catalog. Flutter uses the same visual rhythm over 1.68 seconds. Data and authentication start in parallel with the presentation.

Cards, button presses, navigation icons, tabs and sheets now have deeper spring movement. Banner artwork drifts gently; focusing, hovering or opening a sheet pauses that drift and automatic rotation. Selecting another banner while paused still reveals its text. Internal navigation preserves mobile tab state and does not replay the launch.

System reduced motion bypasses the intro, including changes during the animation. Flutter also respects the saved in-app preference. Keyboard controls are excluded while the web intro covers the store and released when it completes; dialogs restore the previous focus.

Validation:

- Flutter analysis clean; all 38 tests pass, including compact 320px / 2x text, finite completion, safe disposal and retained tab state.
- Web full run: 62/66 passed initially. Four obsolete animation-name or early-position assertions were corrected; the final 21-case targeted run passed across desktop, mobile and 320px. It also covers the added focused-banner regression. The resulting suite contains 69 cases.
- Full admin, storefront and backend production compilation passed. A read-only motion review found the paused-banner entrance issue, which was fixed and regression tested. Light-theme active navigation retains readable blue text throughout motion.
- Contabo read-only preview updated to release `20261014-125352`; readiness and the private loopback listener were verified. Render remains the live service.

The release targets the existing HTTPS API. No live payment or fulfillment was attempted for this animation update.
