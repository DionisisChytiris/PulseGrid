@echo off
"C:\\Program Files\\Java\\jdk-21\\bin\\java" ^
  --class-path ^
  "C:\\gcache\\caches\\modules-2\\files-2.1\\com.google.prefab\\cli\\2.1.0\\aa32fec809c44fa531f01dcfb739b5b3304d3050\\cli-2.1.0-all.jar" ^
  com.google.prefab.cli.AppKt ^
  --build-system ^
  cmake ^
  --platform ^
  android ^
  --abi ^
  arm64-v8a ^
  --os-version ^
  24 ^
  --stl ^
  c++_shared ^
  --ndk-version ^
  27 ^
  --output ^
  "C:\\Users\\dhiti\\AppData\\Local\\Temp\\agp-prefab-staging2709181810859425620\\staged-cli-output" ^
  "C:\\gcache\\caches\\8.14.3\\transforms\\0cb0b508e366a3d8ff1a36493f9d0d20\\transformed\\oboe-1.10.0\\prefab"
