# C++ analysis core

`huntlab_core` contains typed market models and deterministic analysis. It depends only on the C++ standard library. `huntlab_analysis_cli` is a transport adapter that reads protocol v1 from stdin and emits calculated opportunities to stdout; it performs no network or persistence work. The core test target is `huntlab_core_tests` and runs through CTest.
