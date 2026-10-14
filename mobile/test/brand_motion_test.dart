import 'package:donate_app/core/branding/brand_entrance.dart';
import 'package:donate_app/core/storage/preferences_provider.dart';
import 'package:donate_app/core/storage/preferences_service.dart';
import 'package:donate_app/core/widgets/page_motion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget _intro(Widget child, {bool reduceMotion = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(body: child),
  ),
);

void main() {
  testWidgets(
    'cinematic introduction completes exactly once after its finite timeline',
    (tester) async {
      var completions = 0;
      await tester.pumpWidget(
        _intro(BrandEntrance(onComplete: () => completions++)),
      );
      await tester.pump(const Duration(milliseconds: 700));
      expect(completions, 0);
      await tester.pump(const Duration(milliseconds: 700));
      expect(completions, 0);
      await tester.pump(const Duration(milliseconds: 300));
      expect(completions, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(completions, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'introduction skips all delay for the app reduced-motion preference',
    (tester) async {
      var completions = 0;
      await tester.pumpWidget(
        _intro(
          BrandEntrance(reduceMotion: true, onComplete: () => completions++),
        ),
      );
      expect(completions, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(completions, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('system reduced motion interrupts an introduction immediately', (
    tester,
  ) async {
    var completions = 0;
    var systemReduced = false;
    late StateSetter setSystemMotion;
    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) {
            setSystemMotion = setState;
            return MediaQuery(
              data: MediaQueryData(disableAnimations: systemReduced),
              child: Scaffold(
                body: BrandEntrance(onComplete: () => completions++),
              ),
            );
          },
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));
    expect(completions, 0);
    setSystemMotion(() => systemReduced = true);
    await tester.pump();
    expect(completions, 1);
    await tester.pump(const Duration(seconds: 2));
    expect(completions, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('introduction fits a 320px screen with large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(body: BrandEntrance(onComplete: () {})),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 1150));
    expect(tester.takeException(), isNull);
    await tester.pumpAndSettle();
  });

  testWidgets('disposing an active introduction cancels completion safely', (
    tester,
  ) async {
    var completions = 0;
    await tester.pumpWidget(
      _intro(BrandEntrance(onComplete: () => completions++)),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
    expect(completions, 0);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'tab animation preserves child state and skips movement for reduced motion',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      var index = 0;
      var systemReduced = false;
      var childBuilds = 0;
      late StateSetter update;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
          child: MaterialApp(
            home: StatefulBuilder(
              builder: (context, setState) {
                update = setState;
                return MediaQuery(
                  data: MediaQueryData(disableAnimations: systemReduced),
                  child: Scaffold(
                    body: TabReveal(
                      index: index,
                      child: _StatefulCounter(onCreated: () => childBuilds++),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      );
      await tester.tap(find.text('0'));
      await tester.pump();
      update(() => index = 1);
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.text('1'), findsOneWidget);
      expect(childBuilds, 1);
      update(() {
        systemReduced = true;
        index = 2;
      });
      await tester.pump();
      final opacity = tester.widget<Opacity>(
        find
            .descendant(
              of: find.byType(TabReveal),
              matching: find.byType(Opacity),
            )
            .first,
      );
      expect(opacity.opacity, 1);
      expect(childBuilds, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('route transition is immediate for reduced motion', (
    tester,
  ) async {
    await tester.pumpWidget(
      _intro(
        const BrandPageTransition(
          animation: AlwaysStoppedAnimation(0.3),
          secondaryAnimation: AlwaysStoppedAnimation(0),
          reduceMotion: true,
          child: Text('Checkout'),
        ),
      ),
    );
    expect(find.text('Checkout'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(BrandPageTransition),
        matching: find.byType(Opacity),
      ),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });
}

class _StatefulCounter extends StatefulWidget {
  const _StatefulCounter({required this.onCreated});
  final VoidCallback onCreated;

  @override
  State<_StatefulCounter> createState() => _StatefulCounterState();
}

class _StatefulCounterState extends State<_StatefulCounter> {
  var count = 0;
  @override
  void initState() {
    super.initState();
    widget.onCreated();
  }

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: () => setState(() => count++),
    child: Text('$count'),
  );
}
