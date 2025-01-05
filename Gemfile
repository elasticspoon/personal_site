# frozen_string_literal: true

source 'https://rubygems.org'

ruby '3.3.6'

gem 'jekyll'
gem 'kramdown'
gem 'kramdown-parser-gfm'
gem 'webrick'

group :jekyll_plugins do
  gem 'jekyll-inline-svg'
  gem 'jekyll-paginate-v2'
  gem 'jekyll_picture_tag'
  gem 'jekyll-postcss-v2'
  gem 'jekyll-sitemap'
  gem 'jekyll-toc'
end
group :jekyll_plugins, :production do
  gem 'jekyll-brotli'
  gem 'jekyll-gzip'
  gem 'jekyll-minifier'
end
