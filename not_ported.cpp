// Taken from my C++ raytracer.
// Not ported yet

class Plane : public Object3D
{
public:
	Plane(const FW::Vec3f& normal, float offset, Material* m) :
		Object3D(m), normal_(normal.normalized()), offset_(offset) {
		preview_mesh.reset((FW::Mesh<FW::VertexPNT>*)FW::importMesh("preview_assets/plane.obj"));
		set_preview_materials();
	}

	bool intersect(const Ray& r, Hit& h, float tmin) const override;
	void preview_render(FW::GLContext* gl, const FW::Mat4f& objectToCamera, const FW::Mat4f& cameraToClip) const override;

	const FW::Vec3f& normal() const { return normal_; }
	float offset() const { return offset_; }

private:
	FW::Vec3f normal_;
	float offset_;
};

bool Plane::intersect( const Ray& r, Hit& h, float tmin ) const {
	// Intersect the ray with the plane.
	// Pay attention to respecting tmin and h.t!
	// Equation for a plane:
	// ax + by + cz = d;
	// normal . p - d = 0
	// (plug in ray)
	// origin + direction * t = p(t)
	// origin . normal + t * direction . normal = d;
	// t = (d - origin . normal) / (direction . normal);


	// Ray
	Vec3f Ro = r.origin;
	Vec3f Rd = r.direction;

	// Plane
	float D = offset_; // offset
	Vec3f n = normal_; // normal
	float t = (D - dot(n, Ro)) / dot(n, Rd);

	if (t >= tmin && t < h.t){
		h.set(t, this->material(), n);
		return true;
	}
	
	return false;
}

class Triangle : public Object3D
{
public:
	// a triangle contains, in addition to the vertices, 2D texture coordinates,
	// often called "uv coordinates".
	Triangle(const FW::Vec3f& a, const FW::Vec3f& b, const FW::Vec3f &c,
			Material* m,
			const FW::Vec2f& ta = FW::Vec2f(0, 0),
			const FW::Vec2f& tb = FW::Vec2f(0, 0),
			const FW::Vec2f& tc = FW::Vec2f(0, 0), bool load_mesh = true);

	bool intersect(const Ray &r, Hit &h, float tmin) const override;
	void preview_render(FW::GLContext* gl, const FW::Mat4f& objectToCamera, const FW::Mat4f& cameraToClip) const override;

	const FW::Vec3f& vertex(int i) const;

private:
	FW::Vec3f vertices_[3];
	FW::Vec2f texcoords_[3];  
};


Triangle::Triangle(const Vec3f& a, const Vec3f& b, const Vec3f& c,
	Material *m, const Vec2f& ta, const Vec2f& tb, const Vec2f& tc, bool load_mesh) :
	Object3D(m)
{
	vertices_[0] = a;
	vertices_[1] = b;
	vertices_[2] = c;
	texcoords_[0] = ta;
	texcoords_[1] = tb;
	texcoords_[2] = tc;

	if (load_mesh) {
		preview_mesh.reset((FW::Mesh<FW::VertexPNT>*)FW::importMesh("preview_assets/tri.obj"));
		set_preview_materials();
	}
}

bool Triangle::intersect( const Ray& r, Hit& h, float tmin ) const {
	// Intersect the triangle with the ray!
	// Again, pay attention to respecting tmin and h.t!


	// Ray
	Vec3f Ro = r.origin;
	Vec3f Rd = r.direction;

	// T
	Mat3f matrix;
	matrix.setCol(0, Vec3f(vertices_[0].x - vertices_[1].x, vertices_[0].y - vertices_[1].y, vertices_[0].z - vertices_[1].z));
	matrix.setCol(1, Vec3f(vertices_[0].x - vertices_[2].x, vertices_[0].y - vertices_[2].y, vertices_[0].z - vertices_[2].z));
	matrix.setCol(2, Vec3f(Rd.x, Rd.y, Rd.z));

	Mat3f tmatrix;
	tmatrix.setCol(0, Vec3f(vertices_[0].x - vertices_[1].x, vertices_[0].y - vertices_[1].y, vertices_[0].z - vertices_[1].z));
	tmatrix.setCol(1, Vec3f(vertices_[0].x - vertices_[2].x, vertices_[0].y - vertices_[2].y, vertices_[0].z - vertices_[2].z));
	tmatrix.setCol(2, Vec3f(vertices_[0].x - Ro.x, vertices_[0].y - Ro.y, vertices_[0].z - Ro.z));

	Mat3f betamatrix;
	betamatrix.setCol(0, Vec3f(vertices_[0].x - Ro.x, vertices_[0].y - Ro.y, vertices_[0].z - Ro.z));
	betamatrix.setCol(1, Vec3f(vertices_[0].x - vertices_[2].x, vertices_[0].y - vertices_[2].y, vertices_[0].z - vertices_[2].z));
	betamatrix.setCol(2, Vec3f(Rd.x, Rd.y, Rd.z));

	Mat3f lambdamatrix;
	lambdamatrix.setCol(0, Vec3f(vertices_[0].x - vertices_[1].x, vertices_[0].y - vertices_[1].y, vertices_[0].z - vertices_[1].z));
	lambdamatrix.setCol(1, Vec3f(vertices_[0].x - Ro.x, vertices_[0].y - Ro.y, vertices_[0].z - Ro.z));
	lambdamatrix.setCol(2, Vec3f(Rd.x, Rd.y, Rd.z));


	float t = tmatrix.det() / matrix.det();
	float beta = betamatrix.det() / matrix.det();
	float lambda = lambdamatrix.det() / matrix.det();

	if (beta+lambda <1 && beta >0 && lambda >0 && t >= tmin && t < h.t){
		h.set(t, this->material(), cross(vertices_[1] - vertices_[0], vertices_[2] - vertices_[0]).normalized());
		return true;
	}

	return false;
}

const Vec3f& Triangle::vertex(int i) const {
	assert(i >= 0 && i < 3);
	return vertices_[i];
}