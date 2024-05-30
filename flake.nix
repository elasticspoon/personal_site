{
  description = "Jekyll blog";

  inputs = {
    nixpkgs.url = "nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    nix-filter.url = "github:numtide/nix-filter";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    , nix-filter
    ,
    }:
    flake-utils.lib.eachDefaultSystem (system:
    let
      overlays = [
        (self: super: {
          ruby = pkgs.ruby_3_2;
        })
        (final: prev: rec {
          nodejs = prev.nodejs-18_x;
        })
      ];
      pkgs = import nixpkgs { inherit overlays system; };

      rubyEnv = pkgs.bundlerEnv {
        inherit (pkgs) ruby;
        name = "personal_site-bundler-env";
        gemfile = ./Gemfile;
        lockfile = ./Gemfile.lock;
        gemset = ./gemset.nix;
        gemConfig = {
          ruby-vips = attrs: {
            dontBuild = false;
            postInstall = with pkgs; ''
              cd "$(cat $out/nix-support/gem-meta/install-path)"

              substituteInPlace lib/vips.rb \
                --replace "library_name('vips', 42)" '"${lib.getLib vips}/lib/libvips${stdenv.hostPlatform.extensions.sharedLibrary}"' \
                --replace "library_name('glib-2.0', 0)" '"${glib.out}/lib/libglib-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"' \
                --replace "library_name('gobject-2.0', 0)" '"${glib.out}/lib/libgobject-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"'
            '';
          };
          sass-embedded = attrs: {
            DART_SASS = pkgs.fetchurl {
              url = "https://github.com/sass/dart-sass/releases/download/1.64.2/dart-sass-1.64.2-linux-x64.tar.gz";
              sha256 = "sha256-+RmtceWz5K2xaJZvuaJs31tocby4H/LwBBV15DRBCzs";
            };
          };
        };
      };
    in
    {
      devShells = {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [vips nodejs bundix ] ++ [ rubyEnv ];

          shellHook = ''
            PATH="./node_modules/uncss/bin:$PATH"
            export NIX_SHELL="true"
            alias prod_landing='JEKYLL_ENV="production" bundle exec jekyll serve --config "_config.yml,_config_landing.yml" --trace --livereload --livereload-port 35733 --port 3003 '
            alias prod_blog='JEKYLL_ENV="production" bundle exec jekyll serve --trace --livereload --livereload-port 35732 --port 3002 '
            alias dev_landing='bundle exec jekyll serve --config "_config.yml,_config_landing.yml" --trace --livereload --livereload-port 35731 --port 3001 --unpublished'
            alias dev_blog='bundle exec jekyll serve --trace --livereload --livereload-port 35730 --port 3000 --unpublished'
            echo "Run 'dev_landing' or 'dev_blog' to start the development server"
          '';
        };
      };
    });
}
