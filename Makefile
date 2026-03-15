.PHONY: test test-cpp test-web lint build-cpp build-web build all clean

# ── Aggregate targets ──────────────────────────────────────────────────

all: build test

test: test-cpp test-web lint
	@echo ""
	@echo "✓ All tests passed"

build: build-cpp build-web

# ── C++ ────────────────────────────────────────────────────────────────

build-cpp:
	@echo "── Building C++ ──"
	@cmake -B build -DCMAKE_BUILD_TYPE=Release > /dev/null 2>&1
	@cmake --build build --parallel

test-cpp: build-cpp
	@echo "── Running C++ tests ──"
	@cd build && ctest --output-on-failure --timeout 60

# ── Web ────────────────────────────────────────────────────────────────

build-web:
	@echo "── Building web app ──"
	@cd apps/web && npm run build

test-web:
	@echo "── Running web tests ──"
	@cd apps/web && npx vitest run

lint:
	@echo "── Linting web app ──"
	@cd apps/web && npm run lint

# ── Utilities ──────────────────────────────────────────────────────────

clean:
	rm -rf build
	rm -rf apps/web/.next
