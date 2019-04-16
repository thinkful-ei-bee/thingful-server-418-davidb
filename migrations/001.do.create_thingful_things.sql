CREATE TABLE thingful_things (
  id SERIAL PRIMARY KEY,
  image TEXT,
  title TEXT NOT NULL,
  content TEXT,
  date_created TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
