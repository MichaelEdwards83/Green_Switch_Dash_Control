import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

console.log("Preparing to build cross-platform executables...");

try {
    // 1. Read server.js and strip ESM __dirname polyfills
    let code = fs.readFileSync('server.js', 'utf8');
    code = code.replace("import { fileURLToPath } from 'url';", "");
    code = code.replace("const __filename = fileURLToPath(import.meta.url);", "");
    code = code.replace("const __dirname = path.dirname(__filename);", "");
    fs.writeFileSync('server-temp.js', code);

    // 2. Bundle with esbuild
    console.log("Bundling backend server to CJS...");
    execSync('npx esbuild server-temp.js --bundle --platform=node --target=node18 --format=cjs --outfile=server.cjs', { stdio: 'inherit' });

    // 3. Create a temporary package.json for pkg
    const pkgJson = {
        name: "green-switch-dash-control",
        main: "server.cjs",
        pkg: {
            assets: [
                "dist/**/*"
            ]
        }
    };
    fs.writeFileSync('package-pkg.json', JSON.stringify(pkgJson, null, 2));

    // 4. Run native pkg directly to build the matrix
    console.log("Compiling executables with pkg (Targeting Mac and Windows)...");
    execSync('npx pkg server.cjs -c package-pkg.json -t node18-macos-x64,node18-macos-arm64,node18-win-x64 -o bin/SwitchDash', { stdio: 'inherit' });

    // 5. Cleanup temp files
    fs.unlinkSync('server-temp.js');
    fs.unlinkSync('server.cjs');
    fs.unlinkSync('package-pkg.json');

    console.log("✅ Build Complete! Executables are located in the /bin folder.");

} catch (err) {
    console.error("Build failed:", err);
}
