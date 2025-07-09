-- Drop tables if exist
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS areas;

-- Create areas table
CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES areas(id)
);

-- Create projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    areas TEXT,
    detail TEXT,
    images TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on created_at for better sorting performance
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 

-- Drop news table if exists
DROP TABLE IF EXISTS news;

-- Create news table
CREATE TABLE news (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    image TEXT,
    short_intro TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on created_at for news
CREATE INDEX idx_news_created_at ON news(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_news_updated_at
    BEFORE UPDATE ON news
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 