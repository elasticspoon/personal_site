module Jekyll
  module CustomFilters
    def strip_headings(input)
      input.gsub(/<h\d[^>]*>.*?<\/h\d>/i, "")
    end
  end
end

Liquid::Template.register_filter(Jekyll::CustomFilters)
