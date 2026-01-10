import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'www/js/dist',
        lib: {
            entry: resolve(__dirname, 'src/wallet.js'),
            name: 'WalletConnect',
            fileName: 'wallet-bundle',
            formats: ['iife']
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true
            }
        },
        minify: true,
        sourcemap: false
    },
    define: {
        'process.env.NODE_ENV': '"production"'
    }
});
