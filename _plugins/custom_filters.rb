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
        return "Gave Up" if input.zero?
        half_star = ""
        rating = input
      when Float
        half_star = half_rating
        rating = input.floor
      else
        raise StandardError, "Invalid input to parse rating. Passed #{input.class} Must be Integer or Float"
      end

      star * rating + half_star
    end

    def rating_average(items)
      valid_items = items.reject { |item| item["director"].nil? }
      rating_total = valid_items.map { |item| item["rating"] || 0 }.sum
      average_rating = rating_total / valid_items.size
      average_rating.round(2)
      # rating_total = items.map(&:rating).sum
    end

    def rating_chart(items)
      valid_items = items.reject { |item| item["director"].nil? }
      histogram = valid_items.group_by { |item| item["rating"] || 0 }

      # sort the histogram by rating then map to string
      histogram.sort_by { |rating, _items| rating }
        .map do |rating, items|
          rating = (rating != rating.floor) ? nil : rating
          [rating, "*" * items.size]
        end
    end
  end
end

Liquid::Template.register_filter(Jekyll::CustomFilters)
