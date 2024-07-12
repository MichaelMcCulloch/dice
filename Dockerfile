# Use a small base image
FROM rust:alpine as builder

# Install build dependencies
RUN apk add --no-cache musl-dev

# Install miniserve
RUN cargo install miniserve

# Create a new stage with a minimal image
FROM alpine:3.18

# Copy miniserve from the builder stage
COPY --from=builder /usr/local/cargo/bin/miniserve /usr/local/bin/miniserve

# Copy the HTML file
COPY index.html /app/index.html

# Expose port 8080
EXPOSE 8080

# Set the working directory
WORKDIR /app

# Run miniserve
CMD ["miniserve", "--index", "index.html", "--port", "8080", "."]