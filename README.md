OpenSentiment
=============

Open Sentiment is an open source web app that processes social data directly in the browser via javascript. Drag in a CSV file and watch your data come to life with interactive visualizations (using d3.js) and sentiment analysis (scoring free text as being positive/negative in nature).

Try it out with example data here: http://akumpf.github.io/OpenSentiment/#./example_csv_data/fiddlewax_app_reviews.csv

Or start fresh and load your own data here: http://akumpf.github.io/OpenSentiment

## CSV Data Format

OpenSentiment allows you to combine multiple streams of data into a single table by using a standardized structure that can span across multiple forms, users, questions/categories, and responses/data. 

The data should be stored in a CSV (comma separated value) file. Each row of the CSV file contains one response/datavalue. This approach seems a bit heavy at first (for example, requiring 10 rows to store a 10 question form per submission), but it keeps the structure flexible for future data sources (or multiple sources). 

If you're not familiar with CSV, it's a very basic way of storing structured data, and most spreadsheet software (such as Excel) can directly import/export .csv files.

While CSV doesn't scale well to massive datasets, it is simple and works well enough to give a thoughtful overview of complex inputs for initial analysis. OpenSentiment is designed to give initial insights and thus is not optimized for directly supporting massive datasets.

The CSV data should be stored in this form, with exactly 5 columns in this order.

```
FormID,Date,UserID,Question,Response
```

Blank lines are permitted, as well as comment lines beginning with "#".

Note that OpenSentiment will infer the datatype for each row based on the format of the data (and of data in other rows with the same question/category). Three main data types are supported:

* Text   (multiple words with spaces, often quoted. If you have multiple paragraphs/sections, separate with a "|" and keep them all on one line)
* Number (integer or float. will parse first number seen: 93%-effective -> 93)
* Enum   (single word selection. Multiple selections via "|": apples|pears -> apples and pears selected)

See the example_csv_data directory to get a realisitic sense for what the data looks like.

## CSV Data Format (multi-response)

Since many data sets often group multiple responses from a user into a single row, a multi-response CSV format is also supported. To parse data in this manner, select the N:... data type in the dropdown menu on the left.

The first line of the CSV should be a header row in this form.

```
FormID,Date,UserID,Question1,Question2,...,QuestionN
```

And each subsequent row should be the appropriate response to those questions.

```
FormID,Date,UserID,Response1,Response2,...,QuestionN
```

## Loading Data into OpenSentiment

Once you have your data, simply open the index.html file (either locally, or in the latest build hosted at http://akumpf.github.io/OpenSentiment), and drag in your CSV file to corresponding box.

Note that **no data is ever transferred** and all analysis and visualization occur via javascript locally, so you can use the online version. But for those who are working with more sensitive datasets, you can also easily download the entire project and just load the index.html file in your local browser.

Once you drag in the data, it should process it and render something like this:

![OpenSentiment Screenshot](/screenshot.png?raw=true "Open Sentiment Screenshot")

## Making Sense of the Data

Currently, OpenSentiment only works for numerical and English language free text input. For text input, each response is given a sentiment value ranging from -1.0 to 1.0, showing how negative or positive it is. See https://github.com/thisandagain/sentiment for more details on the base library and AFINN model that was used.

All entries with a numeric value (either directly numeric or inferred via sentiment) can then be plotted via a box plot. This shows the median (dark vertical line near the center), lower and upper quartile quartile (the main colored box), as well as the minimum and maximum of all data. Extreme data is also accounted for and shows as outliers in light gray circles beyond the extremes when appropriate.

Enumerated entires (where the user selects items from a list) are also supported, and can be seen in the purple bar graph near the bottom of the example data.

![OpenSentiment data view](/screenshot2.png?raw=true "Open Sentiment data view")

The entire page is interactive, so click around and explore the data to find patterns.

## Data Fetch on Load

OpenSentiment can also automatically fetch data from a remote JSON source or related file path. This is accomplished by loading the page with a URL hash (#).

To load a URL (from the same domain), just include it after the hash and make sure it includes a slash (/):

http://akumpf.github.io/OpenSentiment/#./example_csv_data/fiddlewax_app_reviews.csv


To load from a specialized JSON source, use a comma separated list in the hash. Currently only iOS reviews are supported, but that could be easily expanded. Loading reviews for specific iOS apps is simple -- just use the hash #ios,APP_ID_1,APP_ID_2,...

http://akumpf.github.io/OpenSentiment/#ios,814998374,866070342,905878913


## Caveats

* Text sentiment analysis is currently English only.
* CSV data works great for small/medium datasets, but is heavy and bulky for massive datasets.
* This is beta software, so you may run into bugs. If you do, submit an issue on GitHub (or better yet, make a pull request with your suggestions on how to fix it).

## License

OpenSentiment is Licensed as Creative Commons 0 -- Public Domain except where otherwise noted (the libraries, for example, have their own terms). 

Happy analyzing!


