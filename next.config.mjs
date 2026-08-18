/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silencia o Next sobre pacotes nativos (better-sqlite3) usados em Server Components
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
