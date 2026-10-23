{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{
      flake-parts,
      nixpkgs,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      perSystem =
        {
          pkgs,
          system,
          ...
        }:
        let
          inherit (pkgs) lib;
          manifest = lib.importJSON ./package.json;
          # One pnpm major for the package and the dev shell, so the lockfile
          # format matches.
          pnpm = pkgs.pnpm_12;
        in
        {
          # This sets `pkgs` to a nixpkgs with allowUnfree option set.
          _module.args.pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };

          formatter = pkgs.nixfmt;

          packages.default = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "pele-cli";
            inherit (manifest) version;

            # Only what the build reads, so test and docs changes don't rebuild it.
            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                ./package.json
                ./pnpm-lock.yaml
                ./pnpm-workspace.yaml
                ./tsconfig.json
                ./tsconfig.build.json
                ./src
              ];
            };

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              inherit pnpm;
              fetcherVersion = 4;
              # pnpm creates an empty v11/links directory on macOS but not on
              # Linux, and fetchPnpmDeps packs it, so macOS got a different hash.
              # rmdir fails if it is ever not empty.
              preFixup = ''
                if [ -d "$storePath/v11/links" ]; then
                  rmdir "$storePath/v11/links"
                fi
              '';
              # Changes with every pnpm-lock.yaml change; see the README's Nix section.
              hash = "sha256-U82gcISplh72ZWWxGr5/5/4bWa1FFfWJFbLKHN2/ekg=";
            };

            nativeBuildInputs = [
              pkgs.makeWrapper
              pkgs.nodejs_latest
              pnpm
              pkgs.pnpmBuildHook
              pkgs.pnpmConfigHook
            ];

            installPhase = ''
              runHook preInstall

              # Reinstall with runtime dependencies only (pele). `pnpm prune` re-checks
              # the release-age policy, which needs registry metadata, and an install
              # over the existing node_modules leaves dev packages in node_modules/.pnpm.
              rm -rf node_modules
              pnpm install --offline --prod --frozen-lockfile --ignore-scripts

              package=$out/lib/node_modules/${manifest.name}
              mkdir -p $package
              cp -r dist node_modules package.json $package/
              makeWrapper ${lib.getExe pkgs.nodejs_latest} $out/bin/pele \
                --add-flags $package/dist/cli.js

              runHook postInstall
            '';

            meta = {
              inherit (manifest) description;
              homepage = "https://github.com/ahmedelgabri/pele-cli";
              license = lib.licenses.mit;
              mainProgram = "pele";
            };
          });

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_latest
              pnpm
            ];
            shellHook = /* bash */ ''

            '';
          };
        };
    };
}
