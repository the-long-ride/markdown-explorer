import path from 'node:path';

export const platformCases = [
  { name: 'windows', processPlatform: 'win32', hostPlatform: 'windows', path: path.win32, root: 'C:\\docs', separator: '\\' },
  { name: 'macOS', processPlatform: 'darwin', hostPlatform: 'mac', path: path.posix, root: '/Users/test/docs', separator: '/' },
  { name: 'Linux', processPlatform: 'linux', hostPlatform: 'linux', path: path.posix, root: '/home/test/docs', separator: '/' },
] as const;

export type PlatformCase = (typeof platformCases)[number];
