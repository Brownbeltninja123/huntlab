cmake_minimum_required(VERSION 3.25)
project(HuntLab VERSION 0.1.0 LANGUAGES CXX)

option(HUNTLAB_BUILD_TESTS "Build the deterministic offline test suite" ON)
option(HUNTLAB_ENABLE_CLANG_TIDY "Run clang-tidy during compilation when available" OFF)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(HUNTLAB_ENABLE_CLANG_TIDY)
  find_program(CLANG_TIDY_EXE NAMES clang-tidy)
  if(CLANG_TIDY_EXE)
    set(CMAKE_CXX_CLANG_TIDY "${CLANG_TIDY_EXE}")
  endif()
endif()

add_subdirectory(core)

if(HUNTLAB_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
