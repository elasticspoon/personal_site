with (import <nixpkgs> { }); let
  env = bundlerEnv {
    name = "personal_site-bundler-env";
    ruby = pkgs.ruby;
    gemfile = ./Gemfile;
    lockfile = ./Gemfile.lock;
    gemset = ./gemset.nix;
  };
in
stdenv.mkDerivation {
  name = "personal_site";
  buildInputs = [ env ];

  shellHook = ''
    exec ${env}/bin/jekyll serve --watch
  '';
}
