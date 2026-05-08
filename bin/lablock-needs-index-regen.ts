#!/usr/bin/env bun
import { stagedFiles } from '../lib/git.ts';

const files = await stagedFiles().catch(() => []);
const yes = files.some((f) =>
  /^experiments\/exp-\d{3}-[^/]+\/hypothesis\.md$/.test(f)
  || f.startsWith('.lablock/locks/')
  || f === 'claims.md'
  || f === 'formalism.md'
  || f.startsWith('.lablock/state/change-index'),
);
console.log(yes ? 'yes' : 'no');
