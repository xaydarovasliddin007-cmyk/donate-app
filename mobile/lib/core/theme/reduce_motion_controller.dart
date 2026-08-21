import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/preferences_provider.dart';

/// User-controlled "reduce animations" preference — for older devices or
/// anyone who just prefers snappier, motion-free UI. Real and functional:
/// [PressableScale], [AnimatedBalance], and [StaggeredEntrance] all read
/// this and shorten/skip their durations when it's on, rather than being a
/// settings toggle that does nothing.
class ReduceMotionController extends Notifier<bool> {
  @override
  bool build() => ref.read(preferencesServiceProvider).reduceMotion;

  Future<void> setReduceMotion(bool value) async {
    state = value;
    await ref.read(preferencesServiceProvider).setReduceMotion(value);
  }
}

final reduceMotionProvider = NotifierProvider<ReduceMotionController, bool>(
  ReduceMotionController.new,
);
