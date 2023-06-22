module Jekyll
  module ImageTagFixFilter
    def itag_fix(input)
      page_path = @context.registers[:page]["path"]
      page_name = @context.registers[:page]["name"]
      directory = page_path.gsub(page_name, "")

      "#{directory}#{input}.jpg"
    end
  end
end

Liquid::Template.register_filter(Jekyll::ImageTagFixFilter)
