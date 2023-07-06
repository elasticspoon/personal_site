module Jekyll
  module CustomFilters
    def strip_headings(input)
      input.gsub(/<h\d[^>]*>.*?<\/h\d>/i, "")
    end

    def parse_rating(input)
      half_rating = "½"
      star = "★"

      case input
      when Integer
        half_star = ""
        rating = input
      when Float
        half_star = half_rating
        rating = input.floor
      when String
        return input
      else
        raise StandardError, "Invalid input to parse rating. Passed #{input.class} Must be Integer or Float"
      end

      star * rating + half_star
    end
  end
end

Liquid::Template.register_filter(Jekyll::CustomFilters)
