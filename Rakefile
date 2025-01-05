namespace :jekyll do
  desc 'Serve production landing page'
  task :prod_landing do
    sh 'JEKYLL_ENV="production" bundle exec jekyll serve --config "_config.yml,_config_landing.yml" --trace --livereload --livereload-port 35733 --port 3003'
  end

  desc 'Serve production blog'
  task :prod_blog do
    sh 'JEKYLL_ENV="production" bundle exec jekyll serve --trace --livereload --livereload-port 35732 --port 3002'
  end

  desc 'Serve development landing page'
  task :dev_landing do
    sh 'bundle exec jekyll serve --config "_config.yml,_config_landing.yml" --trace --livereload --livereload-port 35731 --port 3001 --unpublished'
  end

  desc 'Serve development blog'
  task :dev_blog do
    sh 'bundle exec jekyll serve --trace --livereload --livereload-port 35730 --port 3000 --unpublished'
  end
end
