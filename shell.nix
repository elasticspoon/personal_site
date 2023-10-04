with import <nixpkgs> { }; let
  env = bundlerEnv {
    ruby = pkgs.ruby;
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
  nodeEnv = import ./node-env.nix {
    inherit (pkgs) stdenv lib python2 runCommand writeTextFile writeShellScript;
    inherit pkgs nodejs;
    libtool =
      if pkgs.stdenv.isDarwin
      then pkgs.darwin.cctools
      else null;
  };
  nodeDependencies =
    (import ./node-packages.nix {
      inherit (pkgs) fetchurl nix-gitignore stdenv lib fetchgit;
      inherit nodeEnv;
    }).nodeDependencies;
in
stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = with pkgs; [ nodejs bundix ] ++ [ env ];

  shellHook = ''
    if [ ! -L "./node_modules" ]; then
      ln -s "${nodeDependencies}/lib/node_modules" ./node_modules
    fi
    export PATH="${nodeDependencies}/bin:$PATH"
    export NIX_SHELL="true"
    alias prod_landing='JEKYLL_ENV="production" bundle exec jekyll serve --config "_config.yml,_config_landing.yml" --trace --livereload --livereload-port 35733 --port 3003 '
    alias prod_blog='JEKYLL_ENV="production" bundle exec jekyll serve --trace --livereload --livereload-port 35732 --port 3002 '
    alias dev_landing='bundle exec jekyll serve --config "_config.yml,_config_landing.yml" --trace --livereload --livereload-port 35731 --port 3001 --unpublished'
    alias dev_blog='bundle exec jekyll serve --trace --livereload --livereload-port 35730 --port 3000 --unpublished'
  '';
}
