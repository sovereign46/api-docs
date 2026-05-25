import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.100.143', '127.0.0.1'],
};

const withMDX = createMDX();

export default withMDX(config);
