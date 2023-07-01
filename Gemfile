# frozen_string_literal: true

source "https://rubygems.org"

gem "jekyll"
gem "kramdown"
gem "kramdown-parser-gfm"
gem "sass"
gem "webrick"

group :jekyll_plugins do
  gem "jekyll-paginate-v2"
  gem "jekyll-sitemap"
  gem "jekyll_picture_tag"
end
group :jekyll_plugins, :production do
  gem "jekyll-brotli"
  gem "jekyll-gzip"
  gem "jekyll-minifier"
end
