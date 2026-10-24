#!/usr/bin/env node
// SESSION_SECRET 용 무작위 문자열 생성:  npm run gen-secret
import { randomBytes } from 'node:crypto';
console.log(randomBytes(48).toString('base64url'));
