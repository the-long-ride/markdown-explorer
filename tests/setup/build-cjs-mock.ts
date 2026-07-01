import Module from 'node:module';

const load = Module._load;
const fsCache: Record<string, any> = {};

Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'fs' && parent && parent.filename && parent.filename.includes('copy-ui.js')) {
    return fsCache['fs'] || load.call(this, request, parent, isMain);
  }
  return load.call(this, request, parent, isMain);
};

export function setFsMock(mockFs: any) {
  fsCache['fs'] = mockFs;
}

export function clearFsMock() {
  delete fsCache['fs'];
}
