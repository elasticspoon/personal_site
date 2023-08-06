# frozen_string_literal: true

source "https://rubygems.org"

gem "jekyll", "~> 4.2.2"
gem "kramdown"
gem "kramdown-parser-gfm"
gem "sass"
gem "webrick"

group :jekyll_plugins do
  gem "jekyll-paginate-v2"
  gem "jekyll-sitemap"
  gem "jekyll_picture_tag"
  # gem "jekyll_picture_tag", :github => "elasticspoon/jekyll_picture_tag"
  gem "jekyll-postcss-v2"
end
group :jekyll_plugins, :production do
  gem "jekyll-brotli"
  gem "jekyll-gzip"
  gem "jekyll-minifier"
end
