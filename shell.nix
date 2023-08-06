let
  pkgs = import <nixpkgs> { };

  env = pkgs.bundlerEnv {
    ruby = pkgs.ruby;
    name = "personal_site-bundler-env";
    gemfile = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset = ./gemset.nix;
    gemConfig.ruby-vips = attrs: {
      dontBuild = false;
      postInstall = with pkgs; ''
        cd "$(cat $out/nix-support/gem-meta/install-path)"

        substituteInPlace lib/vips.rb \
          --replace "library_name('vips', 42)" '"${lib.getLib vips}/lib/libvips${stdenv.hostPlatform.extensions.sharedLibrary}"' \
          --replace "library_name('glib-2.0', 0)" '"${glib.out}/lib/libglib-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"' \
          --replace "library_name('gobject-2.0', 0)" '"${glib.out}/lib/libgobject-2.0${stdenv.hostPlatform.extensions.sharedLibrary}"'
      '';
    };
  };
in
pkgs.stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = [ env ];

  # shellHook = ''
  #   exec ${env}/bin/jekyll serve --watch
  # '';
}
