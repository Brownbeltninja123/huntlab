add_library(huntlab_core
  src/bazaar_analysis.cpp
  src/fusion_analysis.cpp
)
target_include_directories(huntlab_core PUBLIC include)
target_compile_features(huntlab_core PUBLIC cxx_std_20)
if(MSVC)
  target_compile_options(huntlab_core PRIVATE /W4 /permissive-)
else()
  target_compile_options(huntlab_core PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
endif()

add_executable(huntlab_analysis_cli src/analysis_cli.cpp)
target_link_libraries(huntlab_analysis_cli PRIVATE huntlab_core)
target_compile_features(huntlab_analysis_cli PRIVATE cxx_std_20)

add_executable(huntlab_fusion_cli src/fusion_cli.cpp)
target_link_libraries(huntlab_fusion_cli PRIVATE huntlab_core)
target_compile_features(huntlab_fusion_cli PRIVATE cxx_std_20)

set_target_properties(huntlab_analysis_cli PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
set_target_properties(huntlab_fusion_cli PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
if(MINGW)
  # Keep the analyzer self-contained when Node launches it as a subprocess;
  # end users should not need the compiler's DLL directory on PATH.
  target_link_options(huntlab_analysis_cli PRIVATE -static)
  target_link_options(huntlab_fusion_cli PRIVATE -static)
endif()
