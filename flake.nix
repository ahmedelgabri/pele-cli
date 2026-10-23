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
          # The package and the dev shell use the same Node and pnpm, so the
          # lockfile format and the runtime match.
          nodejs = pkgs.nodejs_latest;
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

            # Only what the package needs, so test and docs changes don't rebuild it.
            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                ./package.json
                ./pnpm-lock.yaml
                ./pnpm-workspace.yaml
                ./src
              ];
            };

            # Runtime dependencies only (pele). The dev dependencies include
            # every platform's TypeScript, oxlint, and oxfmt binaries, about
            # 1 GB that the package never uses.
            pnpmInstallFlags = [ "--prod" ];

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs)
                pname
                version
                src
                pnpmInstallFlags
                ;
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
              hash = "sha256-as8cHIGvs6sRTFGjZPM6AhQymFsIZmeC2AvTtc0I5Fs=";
            };

            nativeBuildInputs = [
              pkgs.makeWrapper
              nodejs
              pnpm
              pkgs.pnpmConfigHook
            ];

            # Node strips the types when it runs src/cli.ts, as the tests do, so
            # there is no TypeScript build.
            dontBuild = true;

            installPhase = ''
              runHook preInstall

              # Not under node_modules/: Node refuses to strip types there.
              package=$out/lib/pele-cli
              mkdir -p $package
              cp -r src node_modules package.json $package/
              makeWrapper ${lib.getExe nodejs} $out/bin/pele \
                --add-flags $package/src/cli.ts

              runHook postInstall
            '';

            meta = {
              inherit (manifest) description homepage;
              license = lib.getLicenseFromSpdxId manifest.license;
              mainProgram = "pele";
            };
          });

          devShells.default = pkgs.mkShell {
            packages = [
              nodejs
              pnpm
            ];
            shellHook = /* bash */ ''

            '';
          };
        };
    };
}
